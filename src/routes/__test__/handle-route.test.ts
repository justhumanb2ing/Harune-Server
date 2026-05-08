import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleHonoError } from "../../lib/error-utils";
import type { AppBindings } from "../../types/app-bindings";
import { createHandleRoute } from "../handle-route";

describe("handle route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a no-store response for handle availability checks", async () => {
    const route = createHandleRoute({
      findProfilePageByHandle: async () => null,
    });

    const app = new Hono<AppBindings>();
    app.use("*", async (c, next) => {
      c.set("db", {} as never);
      c.set("session", { userId: "user-1" } as never);
      await next();
    });
    app.onError(handleHonoError);
    app.route("/handle", route);

    const response = await app.request("/handle/check?handle=maker");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
    expect(await response.json()).toEqual({ available: true });
  });
});
