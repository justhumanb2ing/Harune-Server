import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  unauthorized,
  validationError,
} from "../lib/api-response";
import { isReservedHandle, isValidHandleFormat, normalizeHandle } from "../lib/handles";
import {
  buildPublicObjectUrl,
  copyProfileBentoMediaObject,
  createR2PresignedPutUrl,
  deleteProfileBentoMediaObject,
  getProfileBentoMediaPublicUrl,
  getProfileImageObjectKey,
  getProfileMediaObjectKey,
  getProfileMediaTempObjectKey,
  getProfileMediaTempObjectPrefix,
  getProfileMediaType,
  isAllowedProfileImageContentType,
  isAllowedProfileMediaContentType,
  isProfileBentoMediaObjectKeyForBento,
  MAX_PROFILE_IMAGE_BYTES,
  MAX_PROFILE_MEDIA_BYTES,
  normalizeProfileMediaObjectKey,
  parseObjectKeyFromPublicUrl,
  parseProfileBentoMediaObjectKey,
} from "../lib/profile-media";
import type {
  ProfileBentoSnapshot,
  ProfilePagePatch,
  ProfilePageRecord,
  ProfilePageSummary,
} from "../repositories/profile-repository";
import {
  createProfilePage,
  findOwnedProfileBentoById,
  findProfilePageByHandle,
  findProfilePageByUserId,
  findProfilePages,
  findUserById,
  syncProfileBentoGraph,
  updateProfilePageByUserId,
  updateProfilePageImageByUserId,
} from "../repositories/profile-repository";
import { getProfile } from "../services/get-profile";
import type { AppBindings } from "../types/app-bindings";
import type { ProfilePageResponse, ProfilePagesResponse, ProfileResponse } from "../types/profile";

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
  createProfilePage?: typeof createProfilePage;
  findProfilePageByUserId?: typeof findProfilePageByUserId;
  findProfilePageByHandle?: typeof findProfilePageByHandle;
  findProfilePages?: typeof findProfilePages;
  findUserById?: typeof findUserById;
  updateProfilePageByUserId?: typeof updateProfilePageByUserId;
  updateProfilePageImageByUserId?: typeof updateProfilePageImageByUserId;
  findOwnedProfileBentoById?: typeof findOwnedProfileBentoById;
  syncProfileBentoGraph?: typeof syncProfileBentoGraph;
  getProfile?: typeof getProfile;
  createPresignedPutUrl?: typeof createR2PresignedPutUrl;
};

function withNoStore(response: Response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function waitForProfileCleanup(
  c: { executionCtx?: { waitUntil: (promise: Promise<unknown>) => void } },
  promise: Promise<unknown>
) {
  let executionCtx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

  try {
    executionCtx = c.executionCtx;
  } catch {
    executionCtx = undefined;
  }

  if (executionCtx) {
    executionCtx.waitUntil(promise);
    return;
  }

  void promise.catch((error) => {
    console.error("Failed to run deferred profile cleanup:", error);
  });
}

async function deleteProfileBentoMediaObjects(bucket: R2Bucket, objectKeys: Iterable<string>) {
  const deleteResults = await Promise.allSettled(
    Array.from(objectKeys, async (objectKeyToDelete) => {
      await deleteProfileBentoMediaObject(bucket, objectKeyToDelete);
    })
  );

  for (const result of deleteResults) {
    if (result.status === "rejected") {
      console.error("Failed to delete temporary bento media object:", result.reason);
    }
  }
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

function parseUploadContentLength(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function parseSha256Hex(value: unknown) {
  const parsed = parseTrimmedString(value);

  if (!parsed || !/^[a-f0-9]{64}$/i.test(parsed)) {
    return null;
  }

  return parsed;
}

function parseRequiredEnvString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getProfileMediaUploadConfig(env: AppBindings["Bindings"]) {
  const accountId = parseRequiredEnvString(env.R2_ACCOUNT_ID);
  const accessKeyId = parseRequiredEnvString(env.R2_ACCESS_KEY_ID);
  const secretAccessKey = parseRequiredEnvString(env.R2_SECRET_ACCESS_KEY);
  const bucketName = parseRequiredEnvString(env.PROFILE_MEDIA_BUCKET_NAME);
  const publicBaseUrl = parseRequiredEnvString(env.R2_PUBLIC_BASE_URL);

  const missing = [
    accountId ? null : "R2_ACCOUNT_ID",
    accessKeyId ? null : "R2_ACCESS_KEY_ID",
    secretAccessKey ? null : "R2_SECRET_ACCESS_KEY",
    bucketName ? null : "PROFILE_MEDIA_BUCKET_NAME",
    publicBaseUrl ? null : "R2_PUBLIC_BASE_URL",
  ].filter((value): value is string => value !== null);

  if (missing.length > 0) {
    return { kind: "missing" as const, missing };
  }

  return {
    kind: "ready" as const,
    accountId: accountId as string,
    accessKeyId: accessKeyId as string,
    secretAccessKey: secretAccessKey as string,
    bucketName: bucketName as string,
    publicBaseUrl: publicBaseUrl as string,
  };
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
    segments[3] !== "profile"
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

    if (
      !hostname.endsWith("google.com") &&
      hostname !== "maps.app.goo.gl" &&
      hostname !== "maps.google.com"
    ) {
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

  const allowedKeys = new Set(["name", "location", "role", "bio", "image", "backgroundImage"]);

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

function parseRequiredCreateTextField(value: unknown, maxLength: number) {
  const parsed = parseTrimmedString(value);

  if (!parsed || parsed.length > maxLength) {
    return null;
  }

  return parsed;
}

function parseOptionalCreateTextField(value: unknown, maxLength: number) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = parseRequiredCreateTextField(value, maxLength);
  return parsed;
}

function parseOptionalCreateUrlField(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

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

function parseCreateProfilePageBody(body: unknown) {
  if (!isRecord(body)) {
    return null;
  }

  const allowedKeys = new Set(["handle", "name", "bio", "role", "location", "image"]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return null;
    }
  }

  if (typeof body.handle !== "string" || typeof body.name !== "string") {
    return null;
  }

  const handle = normalizeHandle(body.handle);

  if (!handle || !isValidHandleFormat(handle) || isReservedHandle(handle)) {
    return null;
  }

  const name = parseRequiredCreateTextField(body.name, 120);

  if (!name) {
    return null;
  }

  const bio = parseOptionalCreateTextField(body.bio, 280);
  if (bio === null) {
    return null;
  }

  const role = parseOptionalCreateTextField(body.role, 80);
  if (role === null) {
    return null;
  }

  const location = parseOptionalCreateTextField(body.location, 80);
  if (location === null) {
    return null;
  }

  const image = parseOptionalCreateUrlField(body.image);
  if (image === null) {
    return null;
  }

  return {
    handle,
    name,
    bio,
    role,
    location,
    image,
  };
}

function toProfilePageResponse(page: ProfilePageSummary): ProfilePageResponse["page"] {
  return {
    id: page.id,
    userId: page.userId,
    handle: page.handle,
    name: page.name,
    role: page.role ?? null,
    bio: page.bio ?? null,
    image: page.image,
    backgroundImage: page.backgroundImage,
    location: page.location ?? null,
    updatedAt: page.updatedAt.toISOString(),
  };
}

function toProfilePageRecordResponse(page: ProfilePageRecord) {
  return {
    id: page.id,
    userId: page.userId,
    handle: page.handle,
    name: page.name,
    location: page.location,
    role: page.role,
    bio: page.bio,
    image: page.image,
    backgroundImage: page.backgroundImage,
    linkBlockPosition: page.linkBlockPosition,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function isForeignKeyViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23503"
  );
}

function getDbConstraint(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : null;
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

function parseProfileMediaObjectKeyFromUrlPath(value: string) {
  try {
    const url = new URL(value);
    const objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    return objectKey.startsWith("public/users/") ? objectKey : null;
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
  const alt =
    value.alt === undefined ? "" : typeof value.alt === "string" ? value.alt.trim() : null;
  const caption = value.caption === undefined ? "" : (parseTrimmedString(value.caption) ?? "");
  const tempObjectKey =
    value.tempObjectKey === undefined ? null : parseTrimmedString(value.tempObjectKey);
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

  if (!mediaType || !url || !objectKey || alt === null) {
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
  const caption = value.caption === undefined ? "" : (parseTrimmedString(value.caption) ?? "");
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

async function findSingleProfileMediaTempObjectKey(
  bucket: AppBindings["Bindings"]["PROFILE_MEDIA_BUCKET"],
  userId: string,
  bentoId: string
) {
  const { objects } = await bucket.list({
    prefix: getProfileMediaTempObjectPrefix(userId, bentoId),
    limit: 2,
  });

  if (objects.length !== 1) {
    return null;
  }

  return objects[0]?.key ?? null;
}

async function findExistingProfileMediaObjectKey(
  bucket: AppBindings["Bindings"]["PROFILE_MEDIA_BUCKET"],
  candidates: string[]
) {
  const seen = new Set<string>();
  const uniqueCandidates: string[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    uniqueCandidates.push(candidate);
  }

  const headResults = await Promise.allSettled(
    uniqueCandidates.map(async (candidate) => ({
      candidate,
      object: await bucket.head(candidate),
    }))
  );

  for (const result of headResults) {
    if (result.status === "fulfilled" && result.value.object) {
      return result.value.candidate;
    }
  }

  return null;
}

export function createProfileRoute(dependencies: ProfileRouteDependencies = {}) {
  const createPage = dependencies.createProfilePage ?? createProfilePage;
  const findPageByUserId = dependencies.findProfilePageByUserId ?? findProfilePageByUserId;
  const findPageByHandle = dependencies.findProfilePageByHandle ?? findProfilePageByHandle;
  const findPages = dependencies.findProfilePages ?? findProfilePages;
  const findUserByIdForCreate = dependencies.findUserById ?? findUserById;
  const updatePageByUserId = dependencies.updateProfilePageByUserId ?? updateProfilePageByUserId;
  const updatePageImageByUserId =
    dependencies.updateProfilePageImageByUserId ?? updateProfilePageImageByUserId;
  const findOwnedBentoById = dependencies.findOwnedProfileBentoById ?? findOwnedProfileBentoById;
  const syncBentoGraph = dependencies.syncProfileBentoGraph ?? syncProfileBentoGraph;
  const getProfileForUser = dependencies.getProfile ?? getProfile;
  const createPresignedPutUrl = dependencies.createPresignedPutUrl ?? createR2PresignedPutUrl;

  return new Hono<AppBindings>()
    .post("/me", async (c) => {
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

        const parsed = parseCreateProfilePageBody(body);

        if (!parsed) {
          return withNoStore(validationError(c));
        }

        const db = c.get("db");
        const user = await findUserByIdForCreate(db, session.userId);

        if (!user) {
          return withNoStore(notFound(c, "user_not_found", "user not found"));
        }

        const existingPage = await findPageByUserId(db, session.userId);

        if (existingPage) {
          return withNoStore(conflict(c, "profile_page_exists", "profile page already exists"));
        }

        const existingHandle = await findPageByHandle(db, parsed.handle);

        if (existingHandle) {
          return withNoStore(conflict(c, "handle_taken", "handle already taken"));
        }

        try {
          const committedPage = await createPage(db, {
            userId: session.userId,
            handle: parsed.handle,
            name: parsed.name,
            bio: parsed.bio,
            role: parsed.role,
            location: parsed.location,
            image: parsed.image,
          });

          if (!committedPage) {
            return withNoStore(
              internalServerError(
                c,
                "profile_page_create_failed",
                "failed to load created profile page"
              )
            );
          }

          const response = c.json<ProfilePageResponse>({
            page: toProfilePageResponse(committedPage),
          });

          return withNoStore(response);
        } catch (error) {
          const constraint = getDbConstraint(error);

          if (isUniqueViolation(error)) {
            if (constraint === "profile_page_user_id_idx") {
              return withNoStore(conflict(c, "profile_page_exists", "profile page already exists"));
            }

            if (constraint === "profile_page_handle_idx") {
              return withNoStore(conflict(c, "handle_taken", "handle already taken"));
            }
          }

          if (isForeignKeyViolation(error)) {
            return withNoStore(notFound(c, "user_not_found", "user not found"));
          }

          throw error;
        }
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_page_create_failed", "failed to create profile page")
        );
      }
    })
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

        const committedPage = await updatePageByUserId(c.get("db"), session.userId, patch);

        if (!committedPage) {
          return withNoStore(
            internalServerError(
              c,
              "profile_page_update_failed",
              "failed to load updated profile page"
            )
          );
        }

        const profile = await getProfileForUser(c.get("db"), committedPage.handle, {
          userId: session.userId,
        });

        const response = c.json<ProfileResponse>({
          ...profile,
          page: toProfilePageResponse(committedPage),
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_page_update_failed", "failed to update profile page")
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

        const normalizationResults = await Promise.all(
          bentos.map(
            async (
              bento
            ): Promise<{
              bento: ProfileBentoSnapshot | null;
              tempObjectKeyToDelete: string | null;
              response: Response | null;
              copy?: {
                sourceObjectKey: string;
                targetObjectKey: string;
                contentHash?: string;
                buildBento: (copied: { contentHash: string }) => ProfileBentoSnapshot;
              };
            }> => {
              if (bento.type !== "media") {
                return {
                  bento,
                  tempObjectKeyToDelete: null,
                  response: null,
                };
              }

              const tempObjectKey = bento.content.tempObjectKey;
              const objectKey = bento.content.objectKey;
              const finalObjectKey = getProfileMediaObjectKey(session.userId, bento.id);

              if (tempObjectKey) {
                const parsedTempObjectKey = parseProfileBentoMediaObjectKey(tempObjectKey);
                const ownsTempObjectKey =
                  parsedTempObjectKey !== null &&
                  parsedTempObjectKey.userId === session.userId &&
                  (parsedTempObjectKey.kind === "temp"
                    ? parsedTempObjectKey.bentoId === bento.id ||
                      parsedTempObjectKey.bentoId.startsWith("preview:")
                    : parsedTempObjectKey.bentoId.startsWith("preview:"));

                if (!ownsTempObjectKey) {
                  return {
                    bento: null,
                    tempObjectKeyToDelete: null,
                    response: withNoStore(
                      badRequest(
                        c,
                        "invalid_media_upload_ownership",
                        "Invalid media upload ownership."
                      )
                    ),
                  };
                }

                if (!bento.content.contentHash || !bento.content.contentType) {
                  return {
                    bento: null,
                    tempObjectKeyToDelete: null,
                    response: withNoStore(
                      badRequest(
                        c,
                        "missing_media_upload_metadata",
                        "Missing media upload metadata."
                      )
                    ),
                  };
                }

                if (parsedTempObjectKey?.kind === "final") {
                  const existingPreviewObjectKey = await findExistingProfileMediaObjectKey(
                    c.env.PROFILE_MEDIA_BUCKET,
                    [tempObjectKey]
                  );

                  if (!existingPreviewObjectKey) {
                    return {
                      bento: null,
                      tempObjectKeyToDelete: null,
                      response: withNoStore(
                        badRequest(
                          c,
                          "invalid_media_upload_ownership",
                          "Invalid media upload ownership."
                        )
                      ),
                    };
                  }

                  return {
                    bento: {
                      ...bento,
                      content: {
                        mediaType: bento.content.mediaType,
                        url: getProfileBentoMediaPublicUrl(
                          c.env.R2_PUBLIC_BASE_URL,
                          existingPreviewObjectKey,
                          bento.content.contentHash
                        ),
                        objectKey: existingPreviewObjectKey,
                        href: bento.content.href,
                        alt: bento.content.alt,
                        caption: bento.content.caption,
                      },
                    },
                    tempObjectKeyToDelete: null,
                    response: null,
                  };
                }

                return {
                  bento: null,
                  tempObjectKeyToDelete: tempObjectKey,
                  response: null,
                  copy: {
                    sourceObjectKey: tempObjectKey,
                    targetObjectKey: finalObjectKey,
                    contentHash: bento.content.contentHash ?? undefined,
                    buildBento: (copied) => ({
                      ...bento,
                      content: {
                        mediaType: bento.content.mediaType,
                        url: getProfileBentoMediaPublicUrl(
                          c.env.R2_PUBLIC_BASE_URL,
                          finalObjectKey,
                          bento.content.contentHash ?? copied.contentHash
                        ),
                        objectKey: finalObjectKey,
                        href: bento.content.href,
                        alt: bento.content.alt,
                        caption: bento.content.caption,
                      },
                    }),
                  },
                };
              } else {
                const publicObjectKey =
                  parseObjectKeyFromPublicUrl(c.env.R2_PUBLIC_BASE_URL, bento.content.url) ??
                  parseProfileMediaObjectKeyFromUrlPath(bento.content.url);
                const parsedObjectKey = parseProfileBentoMediaObjectKey(objectKey);
                const normalizedObjectKey = normalizeProfileMediaObjectKey(objectKey);
                const normalizedPublicObjectKey = publicObjectKey
                  ? normalizeProfileMediaObjectKey(publicObjectKey)
                  : null;

                if (
                  !normalizedPublicObjectKey ||
                  !normalizedObjectKey ||
                  normalizedPublicObjectKey !== normalizedObjectKey
                ) {
                  return {
                    bento: null,
                    tempObjectKeyToDelete: null,
                    response: withNoStore(
                      badRequest(
                        c,
                        "profile_media_url_invalid",
                        "media url does not match objectKey"
                      )
                    ),
                  };
                }

                if (isProfileBentoMediaObjectKeyForBento(objectKey, session.userId, bento.id)) {
                  return {
                    bento: {
                      ...bento,
                      content: {
                        mediaType: bento.content.mediaType,
                        url: getProfileBentoMediaPublicUrl(
                          c.env.R2_PUBLIC_BASE_URL,
                          finalObjectKey,
                          bento.content.contentHash ?? ""
                        ),
                        objectKey: finalObjectKey,
                        href: bento.content.href,
                        alt: bento.content.alt,
                        caption: bento.content.caption,
                      },
                    },
                    tempObjectKeyToDelete: null,
                    response: null,
                  };
                } else if (
                  parsedObjectKey &&
                  parsedObjectKey.kind === "final" &&
                  parsedObjectKey.userId === session.userId &&
                  parsedObjectKey.bentoId.startsWith("preview:")
                ) {
                  const existingPreviewObjectKey = await findExistingProfileMediaObjectKey(
                    c.env.PROFILE_MEDIA_BUCKET,
                    [normalizedObjectKey, objectKey, publicObjectKey ?? ""].filter(
                      (candidate) => candidate.length > 0
                    )
                  );

                  if (existingPreviewObjectKey) {
                    return {
                      bento: {
                        ...bento,
                        content: {
                          mediaType: bento.content.mediaType,
                          url: getProfileBentoMediaPublicUrl(
                            c.env.R2_PUBLIC_BASE_URL,
                            existingPreviewObjectKey,
                            bento.content.contentHash ?? ""
                          ),
                          objectKey: existingPreviewObjectKey,
                          href: bento.content.href,
                          alt: bento.content.alt,
                          caption: bento.content.caption,
                        },
                      },
                      tempObjectKeyToDelete: null,
                      response: null,
                    };
                  }

                  const previewTempObjectKey = await findSingleProfileMediaTempObjectKey(
                    c.env.PROFILE_MEDIA_BUCKET,
                    session.userId,
                    parsedObjectKey.bentoId
                  );

                  if (!previewTempObjectKey) {
                    return {
                      bento: null,
                      tempObjectKeyToDelete: null,
                      response: withNoStore(
                        badRequest(
                          c,
                          "invalid_media_upload_ownership",
                          "Invalid media upload ownership."
                        )
                      ),
                    };
                  }

                  return {
                    bento: null,
                    tempObjectKeyToDelete: previewTempObjectKey,
                    response: null,
                    copy: {
                      sourceObjectKey: previewTempObjectKey,
                      targetObjectKey: finalObjectKey,
                      contentHash: bento.content.contentHash ?? undefined,
                      buildBento: (copied) => ({
                        ...bento,
                        content: {
                          mediaType: bento.content.mediaType,
                          url: getProfileBentoMediaPublicUrl(
                            c.env.R2_PUBLIC_BASE_URL,
                            finalObjectKey,
                            bento.content.contentHash ?? copied.contentHash
                          ),
                          objectKey: finalObjectKey,
                          href: bento.content.href,
                          alt: bento.content.alt,
                          caption: bento.content.caption,
                        },
                      }),
                    },
                  };
                } else {
                  return {
                    bento: null,
                    tempObjectKeyToDelete: null,
                    response: withNoStore(
                      badRequest(
                        c,
                        "invalid_media_upload_ownership",
                        "Invalid media upload ownership."
                      )
                    ),
                  };
                }
              }
            }
          )
        );

        const invalidNormalization = normalizationResults.find((result) => result.response);

        if (invalidNormalization?.response) {
          return invalidNormalization.response;
        }

        const tempObjectKeysToDelete = new Set<string>();
        const normalizedBentos = await Promise.all(
          normalizationResults.map(async (result) => {
            if (result.copy) {
              const copied = await copyProfileBentoMediaObject(
                c.env.PROFILE_MEDIA_BUCKET,
                result.copy.sourceObjectKey,
                result.copy.targetObjectKey,
                {
                  contentHash: result.copy.contentHash,
                }
              );

              if (result.tempObjectKeyToDelete) {
                tempObjectKeysToDelete.add(result.tempObjectKeyToDelete);
              }

              return result.copy.buildBento(copied);
            }

            if (!result.bento) {
              throw new Error("missing normalized bento");
            }

            return result.bento;
          })
        );

        await syncBentoGraph(c.get("db"), page.id, normalizedBentos);

        if (tempObjectKeysToDelete.size > 0) {
          waitForProfileCleanup(
            c,
            deleteProfileBentoMediaObjects(c.env.PROFILE_MEDIA_BUCKET, tempObjectKeysToDelete)
          );
        }

        const response = c.json<ProfileResponse>({
          page: toProfilePageResponse(page),
          bento: normalizedBentos,
          viewer: {
            isAuthenticated: true,
            userId: session.userId,
            canEdit: true,
          },
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_bento_sync_failed", "failed to sync profile bento")
        );
      }
    })
    .post("/image", async (c) => {
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

        if (!isRecord(body)) {
          return withNoStore(validationError(c));
        }

        const imageKind = parseImageKind(parseFormValue(body.imageKind));
        const contentType = normalizeContentType(parseFormValue(body.contentType));
        const contentLength = parseUploadContentLength(body.contentLength);
        const imageHash = parseSha256Hex(body.imageHash);

        if (!imageKind || !contentType || !contentLength || !imageHash) {
          return withNoStore(validationError(c));
        }

        if (!isAllowedProfileImageContentType(contentType)) {
          return withNoStore(
            badRequest(c, "profile_image_invalid_type", "invalid image file type")
          );
        }

        if (contentLength > MAX_PROFILE_IMAGE_BYTES) {
          return withNoStore(badRequest(c, "profile_image_too_large", "image file is too large"));
        }

        const uploadConfig = getProfileMediaUploadConfig(c.env);

        const readyUploadConfig = uploadConfig.kind === "ready" ? uploadConfig : null;

        if (!readyUploadConfig) {
          return withNoStore(
            internalServerError(
              c,
              "profile_image_upload_failed",
              "missing profile media upload configuration",
              {
                missing: uploadConfig.missing,
              }
            )
          );
        }

        const objectKey = getProfileImageObjectKey(session.userId, imageKind);
        const { uploadUrl, expiresAt } = await createPresignedPutUrl({
          accountId: readyUploadConfig.accountId,
          accessKeyId: readyUploadConfig.accessKeyId,
          secretAccessKey: readyUploadConfig.secretAccessKey,
          bucketName: readyUploadConfig.bucketName,
          objectKey,
          contentType,
        });

        const response = c.json({
          imageKind,
          imageHash,
          imageUrl: buildPublicObjectUrl(readyUploadConfig.publicBaseUrl, objectKey, imageHash),
          objectKey,
          contentType,
          contentLength,
          uploadUrl,
          expiresAt,
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(
            c,
            "profile_image_upload_failed",
            "failed to create presigned profile image upload"
          )
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
          body
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
            badRequest(
              c,
              "profile_image_url_invalid",
              "imageUrl must point to a profile image object"
            )
          );
        }

        if (target.userId !== session.userId || target.imageKind !== parsed.output.imageKind) {
          return withNoStore(
            forbidden(
              c,
              "profile_image_forbidden",
              "imageUrl does not belong to the authenticated user"
            )
          );
        }

        const object = await c.env.PROFILE_MEDIA_BUCKET.head(target.objectKey);

        if (!object) {
          return withNoStore(
            notFound(c, "profile_image_not_found", "profile image object not found")
          );
        }

        await updatePageImageByUserId(
          c.get("db"),
          session.userId,
          parsed.output.imageKind,
          parsed.output.imageUrl
        );

        const committedPage = await findPageByUserId(c.get("db"), session.userId);

        if (!committedPage) {
          return withNoStore(
            internalServerError(
              c,
              "profile_image_finalize_failed",
              "failed to load updated profile page"
            )
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
          internalServerError(
            c,
            "profile_image_finalize_failed",
            "failed to finalize profile image"
          )
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
          body
        );

        if (!parsed.success) {
          return withNoStore(validationError(c, parsed.issues));
        }

        const target = parseProfileImageTarget(c.env.R2_PUBLIC_BASE_URL, parsed.output.imageUrl);

        if (!target) {
          return withNoStore(
            badRequest(
              c,
              "profile_image_url_invalid",
              "imageUrl must point to a profile image object"
            )
          );
        }

        if (target.userId !== session.userId) {
          return withNoStore(
            forbidden(
              c,
              "profile_image_forbidden",
              "imageUrl does not belong to the authenticated user"
            )
          );
        }

        const object = await c.env.PROFILE_MEDIA_BUCKET.head(target.objectKey);

        if (!object) {
          return withNoStore(
            notFound(c, "profile_image_not_found", "profile image object not found")
          );
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
          internalServerError(c, "profile_image_delete_failed", "failed to delete profile image")
        );
      }
    })
    .post("/bento/media/upload", async (c) => {
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

        if (!isRecord(body)) {
          return withNoStore(validationError(c));
        }

        const bentoId = parseFormValue(body.bentoId);
        const contentType = normalizeContentType(parseFormValue(body.contentType));
        const contentLength = parseUploadContentLength(body.contentLength);
        const contentHash = parseSha256Hex(body.contentHash);

        if (!bentoId || !contentType || !contentLength || !contentHash) {
          return withNoStore(validationError(c));
        }

        const isPreviewBentoId = bentoId.startsWith("preview:");
        const ownedBento = isPreviewBentoId
          ? { id: bentoId }
          : await findOwnedBentoById(c.get("db"), bentoId, session.userId);

        if (!ownedBento) {
          return withNoStore(
            forbidden(
              c,
              "profile_bento_forbidden",
              "bento does not belong to the authenticated user"
            )
          );
        }

        if (contentLength > MAX_PROFILE_MEDIA_BYTES) {
          return withNoStore(badRequest(c, "profile_media_too_large", "media file is too large"));
        }

        if (!isAllowedProfileMediaContentType(contentType)) {
          return withNoStore(
            badRequest(c, "profile_media_invalid_type", "invalid media file type")
          );
        }

        const mediaType = getProfileMediaType(contentType);

        if (!mediaType) {
          return withNoStore(
            badRequest(c, "profile_media_invalid_type", "invalid media file type")
          );
        }

        const uploadConfig = getProfileMediaUploadConfig(c.env);

        const readyUploadConfig = uploadConfig.kind === "ready" ? uploadConfig : null;

        if (!readyUploadConfig) {
          return withNoStore(
            internalServerError(
              c,
              "profile_media_upload_failed",
              "missing profile media upload configuration",
              {
                missing: uploadConfig.missing,
              }
            )
          );
        }

        const objectKey = isPreviewBentoId
          ? getProfileMediaObjectKey(session.userId, bentoId)
          : getProfileMediaTempObjectKey(session.userId, bentoId);

        const { uploadUrl, expiresAt } = await createPresignedPutUrl({
          accountId: readyUploadConfig.accountId,
          accessKeyId: readyUploadConfig.accessKeyId,
          secretAccessKey: readyUploadConfig.secretAccessKey,
          bucketName: readyUploadConfig.bucketName,
          objectKey,
          contentType,
        });

        const response = c.json({
          bentoId,
          contentHash,
          contentType,
          mediaType,
          tempObjectKey: objectKey,
          tempUrl: buildPublicObjectUrl(readyUploadConfig.publicBaseUrl, objectKey, contentHash),
          uploadUrl,
          expiresAt,
          contentLength,
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(
            c,
            "profile_media_upload_failed",
            "failed to create presigned profile media upload"
          )
        );
      }
    })
    .get("/pages", async (c) => {
      try {
        const pages = await findPages(c.get("db"));
        const response = c.json<ProfilePagesResponse>({
          pages: pages.map(toProfilePageRecordResponse),
        });

        return withNoStore(response);
      } catch (error) {
        if (error instanceof HTTPException) {
          throw error;
        }

        return withNoStore(
          internalServerError(c, "profile_pages_failed", "failed to load profile pages")
        );
      }
    })
    .get("/:handle", async (c) => {
      const db = c.get("db");
      const session = c.get("session");
      const profile = await getProfile(db, c.req.param("handle"), {
        userId: session?.userId ?? null,
      });

      return withNoStore(c.json<ProfileResponse>(profile));
    });
}

const profileRoute = createProfileRoute();

export default profileRoute;
export type AppType = typeof profileRoute;
