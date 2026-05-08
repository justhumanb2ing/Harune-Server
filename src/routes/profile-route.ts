import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import {
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  unauthorized,
  validationError,
} from "../lib/api-response";
import {
  buildPublicObjectUrl,
  getProfileImageObjectKey,
  getProfileMediaTempObjectKey,
  getProfileMediaType,
  isAllowedProfileImageContentType,
  isAllowedProfileMediaContentType,
  parseObjectKeyFromPublicUrl,
  sha256Hex,
  MAX_PROFILE_IMAGE_BYTES,
  MAX_PROFILE_MEDIA_BYTES,
} from "../lib/profile-media";
import { AppBindings } from "../types/app-bindings";
import { getProfile } from "../services/get-profile";
import {
  findOwnedProfileBentoById,
  findProfilePageByUserId,
  updateProfilePageImageByUserId,
} from "../repositories/profile-repository";
import type { ProfileResponse } from "../types/profile";

type ProfileRouteDependencies = {
  findProfilePageByUserId?: typeof findProfilePageByUserId;
  updateProfilePageImageByUserId?: typeof updateProfilePageImageByUserId;
  findOwnedProfileBentoById?: typeof findOwnedProfileBentoById;
};

function withNoStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function normalizeContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function parseFormValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseImageKind(value: string) {
  return value === "profile" || value === "background" ? value : null;
}

function parseProfileImageTarget(baseUrl: string, imageUrl: string) {
  const objectKey = parseObjectKeyFromPublicUrl(baseUrl, imageUrl);

  if (!objectKey) {
    return null;
  }

  const segments = objectKey.split("/");

  if (segments.length !== 5 || segments[0] !== "public" || segments[1] !== "users" || segments[3] !== "profile") {
    return null;
  }

  const imageKind = segments[4];

  if (imageKind !== "profile" && imageKind !== "background") {
    return null;
  }

  return {
    objectKey,
    userId: segments[2],
    imageKind,
  } as const;
}

export function createProfileRoute(dependencies: ProfileRouteDependencies = {}) {
  const findPageByUserId = dependencies.findProfilePageByUserId ?? findProfilePageByUserId;
  const updatePageImageByUserId =
    dependencies.updateProfilePageImageByUserId ?? updateProfilePageImageByUserId;
  const findOwnedBentoById =
    dependencies.findOwnedProfileBentoById ?? findOwnedProfileBentoById;

  return new Hono<AppBindings>()
    .post("/image", async (c) => {
      try {
        const session = c.get("session");

        if (!session?.userId) {
          return withNoStore(unauthorized(c, "unauthorized", "authentication required"));
        }

        let formData: FormData;

        try {
          formData = await c.req.formData();
        } catch {
          return withNoStore(validationError(c));
        }

        const file: unknown = formData.get("file");
        const imageHash = parseFormValue(formData.get("imageHash"));
        const imageKind = parseImageKind(parseFormValue(formData.get("imageKind")));

        if (!(file instanceof File) || !imageHash || !imageKind) {
          return withNoStore(validationError(c));
        }

        if (!/^[a-f0-9]{64}$/i.test(imageHash)) {
          return withNoStore(validationError(c));
        }

        const contentType = normalizeContentType(file.type);

        if (!isAllowedProfileImageContentType(contentType)) {
          return withNoStore(badRequest(c, "profile_image_invalid_type", "invalid image file type"));
        }

        if (file.size > MAX_PROFILE_IMAGE_BYTES) {
          return withNoStore(badRequest(c, "profile_image_too_large", "image file is too large"));
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        const contentHash = await sha256Hex(bytes);

        if (contentHash !== imageHash) {
          return withNoStore(
            badRequest(c, "profile_image_hash_mismatch", "uploaded bytes hash does not match imageHash"),
          );
        }

        const objectKey = getProfileImageObjectKey(session.userId, imageKind);
        const bucket = c.env.PROFILE_MEDIA_BUCKET;
        await bucket.put(objectKey, bytes, {
          httpMetadata: {
            contentType,
          },
        });

        const response = c.json({
          imageKind,
          imageUrl: buildPublicObjectUrl(c.env.R2_PUBLIC_BASE_URL, objectKey, contentHash),
          objectKey,
          contentType,
          contentLength: file.size,
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_image_upload_failed", "failed to upload profile image"),
        );
      }
    })
    .patch("/image", async (c) => {
      try {
        const session = c.get("session");

        if (!session?.userId) {
          return withNoStore(unauthorized(c, "unauthorized", "authentication required"));
        }

        let body: unknown;

        try {
          body = await c.req.json();
        } catch {
          return withNoStore(validationError(c));
        }

        const parsed = v.safeParse(
          v.object({
            imageKind: v.picklist(["profile", "background"]),
            imageUrl: v.pipe(v.string(), v.trim(), v.nonEmpty("imageUrl is required")),
          }),
          body,
        );

        if (!parsed.success) {
          return withNoStore(validationError(c, parsed.issues));
        }

        const page = await findPageByUserId(c.get("db"), session.userId);

        if (!page) {
          return withNoStore(notFound(c, "profile_page_not_found", "profile page not found"));
        }

        const target = parseProfileImageTarget(c.env.R2_PUBLIC_BASE_URL, parsed.output.imageUrl);

        if (!target) {
          return withNoStore(
            badRequest(c, "profile_image_url_invalid", "imageUrl must point to a profile image object"),
          );
        }

        if (target.userId !== session.userId || target.imageKind !== parsed.output.imageKind) {
          return withNoStore(
            forbidden(c, "profile_image_forbidden", "imageUrl does not belong to the authenticated user"),
          );
        }

        const object = await c.env.PROFILE_MEDIA_BUCKET.head(target.objectKey);

        if (!object) {
          return withNoStore(notFound(c, "profile_image_not_found", "profile image object not found"));
        }

        await updatePageImageByUserId(c.get("db"), session.userId, parsed.output.imageKind, parsed.output.imageUrl);

        const committedPage = await findPageByUserId(c.get("db"), session.userId);

        if (!committedPage) {
          return withNoStore(
            internalServerError(c, "profile_image_finalize_failed", "failed to load updated profile page"),
          );
        }

        const response = c.json({
          imageKind: parsed.output.imageKind,
          imageUrl: parsed.output.imageUrl,
          image: committedPage.image,
          backgroundImage: committedPage.backgroundImage,
          updatedAt: committedPage.updatedAt.toISOString(),
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_image_finalize_failed", "failed to finalize profile image"),
        );
      }
    })
    .delete("/image", async (c) => {
      try {
        const session = c.get("session");

        if (!session?.userId) {
          return withNoStore(unauthorized(c, "unauthorized", "authentication required"));
        }

        let body: unknown;

        try {
          body = await c.req.json();
        } catch {
          return withNoStore(validationError(c));
        }

        const parsed = v.safeParse(
          v.object({
            imageUrl: v.pipe(v.string(), v.trim(), v.nonEmpty("imageUrl is required")),
          }),
          body,
        );

        if (!parsed.success) {
          return withNoStore(validationError(c, parsed.issues));
        }

        const target = parseProfileImageTarget(c.env.R2_PUBLIC_BASE_URL, parsed.output.imageUrl);

        if (!target) {
          return withNoStore(
            badRequest(c, "profile_image_url_invalid", "imageUrl must point to a profile image object"),
          );
        }

        if (target.userId !== session.userId) {
          return withNoStore(
            forbidden(c, "profile_image_forbidden", "imageUrl does not belong to the authenticated user"),
          );
        }

        const object = await c.env.PROFILE_MEDIA_BUCKET.head(target.objectKey);

        if (!object) {
          return withNoStore(notFound(c, "profile_image_not_found", "profile image object not found"));
        }

        await c.env.PROFILE_MEDIA_BUCKET.delete(target.objectKey);

        const response = c.json({
          success: true,
          deletedObjectKey: target.objectKey,
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_image_delete_failed", "failed to delete profile image"),
        );
      }
    })
    .post("/bento/media/upload", async (c) => {
      try {
        const session = c.get("session");

        if (!session?.userId) {
          return withNoStore(unauthorized(c, "unauthorized", "authentication required"));
        }

        let formData: FormData;

        try {
          formData = await c.req.formData();
        } catch {
          return withNoStore(validationError(c));
        }

        const file: unknown = formData.get("file");
        const bentoId = parseFormValue(formData.get("bentoId"));

        if (!(file instanceof File) || !bentoId) {
          return withNoStore(validationError(c));
        }

        const isPreviewBentoId = bentoId.startsWith("preview:");
        const ownedBento = isPreviewBentoId
          ? { id: bentoId }
          : await findOwnedBentoById(c.get("db"), bentoId, session.userId);

        if (!ownedBento) {
          return withNoStore(
            forbidden(c, "profile_bento_forbidden", "bento does not belong to the authenticated user"),
          );
        }

        if (file.size > MAX_PROFILE_MEDIA_BYTES) {
          return withNoStore(badRequest(c, "profile_media_too_large", "media file is too large"));
        }

        const contentType = normalizeContentType(file.type);

        if (!isAllowedProfileMediaContentType(contentType)) {
          return withNoStore(badRequest(c, "profile_media_invalid_type", "invalid media file type"));
        }

        const mediaType = getProfileMediaType(contentType);

        if (!mediaType) {
          return withNoStore(badRequest(c, "profile_media_invalid_type", "invalid media file type"));
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        const contentHash = await sha256Hex(bytes);
        const tempObjectKey = getProfileMediaTempObjectKey(session.userId, bentoId);

        await c.env.PROFILE_MEDIA_BUCKET.put(tempObjectKey, bytes, {
          httpMetadata: {
            contentType,
          },
        });

        const response = c.json({
          bentoId,
          contentHash,
          contentType,
          mediaType,
          tempObjectKey,
          tempUrl: buildPublicObjectUrl(c.env.R2_PUBLIC_BASE_URL, tempObjectKey),
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_media_upload_failed", "failed to upload profile media"),
        );
      }
    })
    .get("/:handle", async (c) => {
      const db = c.get("db");
      const session = c.get("session");
      const profile = await getProfile(db, c.req.param("handle"), {
        userId: session?.userId ?? null,
      });

      return c.json<ProfileResponse>(profile);
    });
}

const profileRoute = createProfileRoute();

export default profileRoute;
export type AppType = typeof profileRoute;
