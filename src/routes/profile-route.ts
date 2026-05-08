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
  copyProfileBentoMediaObject,
  deleteProfileBentoMediaObject,
  getProfileImageObjectKey,
  getProfileBentoMediaPublicUrl,
  getProfileMediaObjectKey,
  getProfileMediaTempObjectKey,
  getProfileMediaType,
  isAllowedProfileImageContentType,
  isAllowedProfileMediaContentType,
  isProfileBentoMediaObjectKeyForBento,
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
  syncProfileBentoGraph,
  updateProfilePageImageByUserId,
  updateProfilePageByUserId,
} from "../repositories/profile-repository";
import type { ProfileBentoSnapshot, ProfilePagePatch } from "../repositories/profile-repository";
import type { ProfileResponse } from "../types/profile";

type ParsedProfileBentoItem =
  | {
      id: string;
      type: "link";
      layout: ProfileBentoSnapshot["layout"];
      content: {
        title: string;
        description: string | null;
        favicon: string | null;
        thumbnail: string | null;
        url: string;
      };
    }
  | {
      id: string;
      type: "text";
      layout: ProfileBentoSnapshot["layout"];
      content: {
        content: string;
      };
    }
  | {
      id: string;
      type: "section";
      layout: ProfileBentoSnapshot["layout"];
      content: {
        title: string;
      };
    }
  | {
      id: string;
      type: "media";
      layout: ProfileBentoSnapshot["layout"];
      content: {
        mediaType: "image" | "video";
        url: string;
        objectKey: string;
        href: string | null;
        alt: string;
        caption: string;
        tempObjectKey: string | null;
        contentHash: string | null;
        contentType: string | null;
      };
    }
  | {
      id: string;
      type: "map";
      layout: ProfileBentoSnapshot["layout"];
      content: {
        latitude: number;
        longitude: number;
        zoom: number;
        caption: string;
        url: string;
      };
    };

type ProfileRouteDependencies = {
  findProfilePageByUserId?: typeof findProfilePageByUserId;
  updateProfilePageByUserId?: typeof updateProfilePageByUserId;
  updateProfilePageImageByUserId?: typeof updateProfilePageImageByUserId;
  findOwnedProfileBentoById?: typeof findOwnedProfileBentoById;
  syncProfileBentoGraph?: typeof syncProfileBentoGraph;
  getProfile?: typeof getProfile;
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

  if (
    segments.length !== 5 ||
    segments[0] !== "public" ||
    segments[1] !== "users" ||
    segments[3] !== "profile-page"
  ) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTrimmedString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalNullableTextField(value: unknown) {
  if (value === null) {
    return null;
  }

  return parseTrimmedString(value);
}

function parseOptionalNullableUrlField(value: unknown) {
  const parsed = parseOptionalNullableTextField(value);

  if (parsed === null) {
    return value === null ? null : null;
  }

  try {
    const url = new URL(parsed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function parsePositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseGoogleMapsUrl(value: unknown) {
  const parsed = parseTrimmedString(value);

  if (!parsed) {
    return null;
  }

  try {
    const url = new URL(parsed);
    const hostname = url.hostname.toLowerCase();

    if (!hostname.endsWith("google.com") && hostname !== "maps.app.goo.gl" && hostname !== "maps.google.com") {
      return null;
    }

    if (!url.pathname.includes("maps") && hostname !== "maps.app.goo.gl") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function parseLayout(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const x = parsePositiveInteger(value.x);
  const y = parsePositiveInteger(value.y);
  const w = parsePositiveInteger(value.w);
  const h = parsePositiveInteger(value.h);

  if (x === null || y === null || w === null || h === null) {
    return null;
  }

  return { x, y, w, h };
}

function parseProfilePagePatch(body: unknown): ProfilePagePatch | null {
  if (!isRecord(body)) {
    return null;
  }

  const allowedKeys = new Set([
    "name",
    "location",
    "role",
    "bio",
    "image",
    "backgroundImage",
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return null;
    }
  }

  const patch: ProfilePagePatch = {};

  if ("name" in body) {
    const value = parseOptionalNullableTextField(body.name);
    if (value === null && body.name !== null) {
      return null;
    }
    patch.name = value;
  }

  if ("location" in body) {
    const value = parseOptionalNullableTextField(body.location);
    if (value === null && body.location !== null) {
      return null;
    }
    patch.location = value;
  }

  if ("role" in body) {
    const value = parseOptionalNullableTextField(body.role);
    if (value === null && body.role !== null) {
      return null;
    }
    patch.role = value;
  }

  if ("bio" in body) {
    const value = parseOptionalNullableTextField(body.bio);
    if (value === null && body.bio !== null) {
      return null;
    }
    patch.bio = value;
  }

  if ("image" in body) {
    const value = parseOptionalNullableUrlField(body.image);
    if (value === null && body.image !== null) {
      return null;
    }
    patch.image = value;
  }

  if ("backgroundImage" in body) {
    const value = parseOptionalNullableUrlField(body.backgroundImage);
    if (value === null && body.backgroundImage !== null) {
      return null;
    }
    patch.backgroundImage = value;
  }

  return patch;
}

function parseProfileBentoContentUrl(value: unknown) {
  const parsed = parseTrimmedString(value);

  if (!parsed) {
    return null;
  }

  try {
    const url = new URL(parsed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function parseContentHashFromUrl(value: string) {
  try {
    const url = new URL(value);
    const hash = url.searchParams.get("v");
    return hash && hash.trim().length > 0 ? hash.trim() : null;
  } catch {
    return null;
  }
}

function parseLinkBentoContent(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const title = parseTrimmedString(value.title);
  const url = parseProfileBentoContentUrl(value.url);

  if (!title || !url) {
    return null;
  }

  return {
    title,
    description:
      value.description === undefined
        ? null
        : value.description === null
          ? null
          : parseOptionalNullableTextField(value.description),
    favicon:
      value.favicon === undefined
        ? null
        : value.favicon === null
          ? null
          : parseOptionalNullableUrlField(value.favicon),
    thumbnail:
      value.thumbnail === undefined
        ? null
        : value.thumbnail === null
          ? null
          : parseOptionalNullableUrlField(value.thumbnail),
    url,
  };
}

function parseTextBentoContent(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const content = parseTrimmedString(value.content);
  return content ? { content } : null;
}

function parseSectionBentoContent(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const title = parseTrimmedString(value.title);
  return title ? { title } : null;
}

function parseMediaBentoContent(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const mediaType =
    value.mediaType === "image" || value.mediaType === "video"
      ? (value.mediaType as "image" | "video")
      : null;
  const url = parseProfileBentoContentUrl(value.url);
  const objectKey = parseTrimmedString(value.objectKey);
  const href =
    value.href === undefined
      ? null
      : value.href === null
        ? null
        : parseOptionalNullableUrlField(value.href);
  const alt = parseTrimmedString(value.alt);
  const caption = value.caption === undefined ? "" : parseTrimmedString(value.caption) ?? "";
  const tempObjectKey = value.tempObjectKey === undefined ? null : parseTrimmedString(value.tempObjectKey);
  const contentHash =
    value.contentHash === undefined
      ? url
        ? parseContentHashFromUrl(url)
        : null
      : parseTrimmedString(value.contentHash);
  const contentType =
    value.contentType === undefined
      ? null
      : value.contentType === null
        ? null
        : parseTrimmedString(value.contentType);

  if (!mediaType || !url || !objectKey || !alt) {
    return null;
  }

  return {
    mediaType,
    url,
    objectKey,
    href,
    alt,
    caption,
    tempObjectKey,
    contentHash,
    contentType,
  };
}

function parseMapBentoContent(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const latitude = parseFiniteNumber(value.latitude);
  const longitude = parseFiniteNumber(value.longitude);
  const zoom = parsePositiveInteger(value.zoom);
  const caption = value.caption === undefined ? "" : parseTrimmedString(value.caption) ?? "";
  const url = parseGoogleMapsUrl(value.url);

  if (latitude === null || longitude === null || zoom === null || !url) {
    return null;
  }

  return {
    latitude,
    longitude,
    zoom,
    caption,
    url,
  };
}

function parseBentoLayoutSnapshot(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const desktop = parseLayout(value.desktop);
  const compact = parseLayout(value.compact);

  if (!desktop || !compact) {
    return null;
  }

  return { desktop, compact };
}

function parseProfileBentoItem(item: unknown): ParsedProfileBentoItem | null {
  if (!isRecord(item)) {
    return null;
  }

  const id = parseTrimmedString(item.id);
  const type = item.type;
  const layout = parseBentoLayoutSnapshot(item.layout);

  if (!id || !layout) {
    return null;
  }

  switch (type) {
    case "link": {
      const content = parseLinkBentoContent(item.content);
      return content ? { id, type, layout, content } : null;
    }
    case "text": {
      const content = parseTextBentoContent(item.content);
      return content ? { id, type, layout, content } : null;
    }
    case "section": {
      const content = parseSectionBentoContent(item.content);
      return content ? { id, type, layout, content } : null;
    }
    case "media": {
      const content = parseMediaBentoContent(item.content);
      return content ? { id, type, layout, content } : null;
    }
    case "map": {
      const content = parseMapBentoContent(item.content);
      return content ? { id, type, layout, content } : null;
    }
    default:
      return null;
  }
}

function parseProfileBentoItems(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.bento)) {
    return null;
  }

  const parsedItems: ParsedProfileBentoItem[] = [];
  const seenIds = new Set<string>();

  for (const item of body.bento) {
    const parsed = parseProfileBentoItem(item);

    if (!parsed) {
      return null;
    }

    if (seenIds.has(parsed.id)) {
      return null;
    }

    seenIds.add(parsed.id);

    parsedItems.push(parsed);
  }

  return parsedItems;
}

export function createProfileRoute(dependencies: ProfileRouteDependencies = {}) {
  const findPageByUserId = dependencies.findProfilePageByUserId ?? findProfilePageByUserId;
  const updatePageByUserId =
    dependencies.updateProfilePageByUserId ?? updateProfilePageByUserId;
  const updatePageImageByUserId =
    dependencies.updateProfilePageImageByUserId ?? updateProfilePageImageByUserId;
  const findOwnedBentoById =
    dependencies.findOwnedProfileBentoById ?? findOwnedProfileBentoById;
  const syncBentoGraph = dependencies.syncProfileBentoGraph ?? syncProfileBentoGraph;
  const getProfileForUser = dependencies.getProfile ?? getProfile;

  return new Hono<AppBindings>()
    .put("/me", async (c) => {
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

        const patch = parseProfilePagePatch(body);

        if (!patch) {
          return withNoStore(validationError(c));
        }

        const page = await findPageByUserId(c.get("db"), session.userId);

        if (!page) {
          return withNoStore(notFound(c, "profile_page_not_found", "profile page not found"));
        }

        await updatePageByUserId(c.get("db"), session.userId, patch);

        const committedPage = await findPageByUserId(c.get("db"), session.userId);

        if (!committedPage) {
          return withNoStore(
            internalServerError(c, "profile_page_update_failed", "failed to load updated profile page"),
          );
        }

        const response = c.json(
          await getProfileForUser(c.get("db"), committedPage.handle, { userId: session.userId }),
        );

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_page_update_failed", "failed to update profile page"),
        );
      }
    })
    .put("/me/bento", async (c) => {
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

        const bentos = parseProfileBentoItems(body);

        if (!bentos) {
          return withNoStore(validationError(c));
        }

        const page = await findPageByUserId(c.get("db"), session.userId);

        if (!page) {
          return withNoStore(notFound(c, "profile_page_not_found", "profile page not found"));
        }

        const normalizedBentos: ProfileBentoSnapshot[] = [];

        for (const bento of bentos) {
          if (bento.type !== "media") {
            normalizedBentos.push(bento);
            continue;
          }

          const tempObjectKey = bento.content.tempObjectKey;
          const objectKey = bento.content.objectKey;
          const finalObjectKey = getProfileMediaObjectKey(session.userId, bento.id);

          if (tempObjectKey) {
            if (!isProfileBentoMediaObjectKeyForBento(tempObjectKey, session.userId, bento.id)) {
              return withNoStore(
                badRequest(c, "invalid_media_upload_ownership", "Invalid media upload ownership."),
              );
            }

            if (!bento.content.contentHash || !bento.content.contentType) {
              return withNoStore(
                badRequest(c, "missing_media_upload_metadata", "Missing media upload metadata."),
              );
            }

            await copyProfileBentoMediaObject(c.env.PROFILE_MEDIA_BUCKET, tempObjectKey, finalObjectKey);
          } else {
            if (!isProfileBentoMediaObjectKeyForBento(objectKey, session.userId, bento.id)) {
              return withNoStore(
                badRequest(c, "invalid_media_upload_ownership", "Invalid media upload ownership."),
              );
            }

            const publicObjectKey = parseObjectKeyFromPublicUrl(c.env.R2_PUBLIC_BASE_URL, bento.content.url);

            if (publicObjectKey !== objectKey) {
              return withNoStore(
                badRequest(c, "profile_media_url_invalid", "media url does not match objectKey"),
              );
            }
          }

          normalizedBentos.push({
            ...bento,
            content: {
              mediaType: bento.content.mediaType,
              url: getProfileBentoMediaPublicUrl(
                c.env.R2_PUBLIC_BASE_URL,
                finalObjectKey,
                bento.content.contentHash ?? "",
              ),
              objectKey: finalObjectKey,
              href: bento.content.href,
              alt: bento.content.alt,
              caption: bento.content.caption,
            },
          });
        }

        await syncBentoGraph(c.get("db"), page.id, normalizedBentos);

        for (const bento of bentos) {
          if (bento.type !== "media" || !bento.content.tempObjectKey) {
            continue;
          }

          try {
            await deleteProfileBentoMediaObject(c.env.PROFILE_MEDIA_BUCKET, bento.content.tempObjectKey);
          } catch (error) {
            console.error("Failed to delete temporary bento media object:", error);
          }
        }

        const response = c.json(
          await getProfileForUser(c.get("db"), page.handle, { userId: session.userId }),
        );

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_bento_sync_failed", "failed to sync profile bento"),
        );
      }
    })
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
