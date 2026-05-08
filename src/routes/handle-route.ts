import { Hono } from "hono";
import * as v from "valibot";

import {
  conflict,
  internalServerError,
  notFound,
  unauthorized,
  validationError,
} from "../lib/api-response";
import type { Database } from "../lib/db";
import { isReservedHandle } from "../lib/handles";
import {
  findProfilePageByHandle as findProfilePageByHandleInDb,
  findProfilePageByUserId as findProfilePageByUserIdInDb,
  type ProfilePageSummary,
  updateProfilePageHandleById as updateProfilePageHandleByIdInDb,
} from "../repositories/profile-repository";
import type { AppBindings } from "../types/app-bindings";

type HandlePageRecord = {
  userId: string;
  handle: string;
};

type HandleProfilePageRecord = ProfilePageSummary;

type HandleRouteDependencies = {
  findProfilePageByHandle?: (db: Database, handle: string) => Promise<HandlePageRecord | null>;
  findProfilePageByUserId?: (
    db: Database,
    userId: string
  ) => Promise<HandleProfilePageRecord | null>;
  updateProfilePageHandleById?: (
    db: Database,
    profilePageId: string,
    handle: string
  ) => Promise<HandleProfilePageRecord | null>;
};

const handleInputSchema = v.object({
  handle: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("handle is required"),
    v.transform((value) => value.toLowerCase()),
    v.regex(/^[A-Za-z0-9_]+$/, "Only letters, numbers, and underscores are allowed."),
    v.custom<string>((value) => !isReservedHandle(value as string), "This handle is not available.")
  ),
});

const handleCheckQuerySchema = handleInputSchema;

function toHandleProfilePage(page: HandleProfilePageRecord) {
  return {
    id: page.id,
    handle: page.handle,
    name: page.name,
    image: page.image,
  };
}

export function createHandleRoute(dependencies: HandleRouteDependencies = {}) {
  const findProfilePageByHandle =
    dependencies.findProfilePageByHandle ?? findProfilePageByHandleInDb;
  const findProfilePageByUserId =
    dependencies.findProfilePageByUserId ?? findProfilePageByUserIdInDb;
  const updateProfilePageHandleById =
    dependencies.updateProfilePageHandleById ?? updateProfilePageHandleByIdInDb;

  return new Hono<AppBindings>()
    .get("/check", async (c) => {
      const parsed = v.safeParse(handleCheckQuerySchema, {
        handle: c.req.query("handle") ?? "",
      });

      if (!parsed.success) {
        return validationError(c, parsed.issues);
      }

      const handle = parsed.output.handle;
      const session = c.get("session");

      if (!session?.userId) {
        return unauthorized(c, "unauthorized", "authentication required");
      }

      const db = c.get("db");
      const page = await findProfilePageByHandle(db, handle);

      if (!page) {
        const response = c.json({ available: true });
        response.headers.set("Cache-Control", "no-store");
        response.headers.set("Pragma", "no-cache");
        return response;
      }

      const response = c.json({
        available: page.userId === session.userId,
      });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Pragma", "no-cache");
      return response;
    })
    .patch("/", async (c) => {
      const session = c.get("session");

      if (!session?.userId) {
        return unauthorized(c, "unauthorized", "authentication required");
      }

      let body: unknown;

      try {
        body = await c.req.json();
      } catch {
        return validationError(c);
      }

      const parsed = v.safeParse(handleInputSchema, body);

      if (!parsed.success) {
        return validationError(c, parsed.issues);
      }

      const db = c.get("db");
      const requestedHandle = parsed.output.handle;
      const currentPage = await findProfilePageByUserId(db, session.userId);

      if (!currentPage) {
        return notFound(c, "profile_not_found", "profile page not found");
      }

      if (currentPage.handle.trim().toLowerCase() === requestedHandle) {
        const response = c.json({
          previousHandle: currentPage.handle,
          profilePage: toHandleProfilePage(currentPage),
        });
        response.headers.set("Cache-Control", "no-store");
        return response;
      }

      const existingPage = await findProfilePageByHandle(db, requestedHandle);

      if (existingPage && existingPage.userId !== session.userId) {
        return conflict(c, "handle_taken", "handle already taken");
      }

      const committedPage = await updateProfilePageHandleById(db, currentPage.id, requestedHandle);

      if (!committedPage) {
        return internalServerError(
          c,
          "handle_update_failed",
          "failed to load updated profile page"
        );
      }

      const response = c.json({
        previousHandle: currentPage.handle,
        profilePage: toHandleProfilePage(committedPage),
      });
      response.headers.set("Cache-Control", "no-store");
      return response;
    });
}

const handleRoute = createHandleRoute();

export default handleRoute;
export type AppType = typeof handleRoute;
