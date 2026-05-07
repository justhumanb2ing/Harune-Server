import { Hono } from "hono";
import * as v from "valibot";

import { validationError, unauthorized } from "../lib/api-response";
import { findProfilePageByHandle as findProfilePageByHandleInDb } from "../repositories/profile-repository";
import { isReservedHandle } from "../lib/handles";
import { AppBindings } from "../types/app-bindings";
import { Database } from "../lib/db";

type HandlePageRecord = {
  userId: string;
  handle: string;
};

type HandleRouteDependencies = {
  findProfilePageByHandle?: (
    db: Database,
    handle: string,
  ) => Promise<HandlePageRecord | null>;
};

const handleCheckQuerySchema = v.object({
  handle: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty("handle is required"),
    v.transform((value) => value.toLowerCase()),
    v.regex(/^[A-Za-z0-9_]+$/, "Only letters, numbers, and underscores are allowed."),
    v.custom<string>(
      (value) => !isReservedHandle(value as string),
      "This handle is not available.",
    ),
  ),
});

export function createHandleRoute(
  dependencies: HandleRouteDependencies = {},
) {
  const findProfilePageByHandle =
    dependencies.findProfilePageByHandle ?? findProfilePageByHandleInDb;

  return new Hono<AppBindings>().get("/check", async (c) => {
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
      return c.json({ available: true });
    }

    return c.json({
      available: page.userId === session.userId,
    });
  });
}

const handleRoute = createHandleRoute();

export default handleRoute;
export type AppType = typeof handleRoute;
