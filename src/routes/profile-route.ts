import { Hono } from "hono";

import { AppBindings } from "../types/app-bindings";
import { getProfile } from "../services/get-profile";
import type { ProfileResponse } from "../types/profile";

const profileRoute = new Hono<AppBindings>()
  .get("/:handle", async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const profile = await getProfile(db, c.req.param("handle"), {
      userId: session?.userId ?? null,
    });

    return c.json<ProfileResponse>(profile);
  });

export default profileRoute;
export type AppType = typeof profileRoute;
