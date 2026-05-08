import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import honoFactory from "../../hono-factory";
import type { AppBindings } from "../../types/app-bindings";
import { csrfMiddleware } from "../csrf-middleware";

describe("csrfMiddleware", () => {
  it("skips auth routes so Better Auth can handle its own CSRF and origin checks", async () => {
    const app = new Hono<AppBindings>();
    app.use("*", honoFactory.createMiddleware(async (c, next) => {
      c.set("auth", { api: { getSession: async () => ({ user: null, session: null }) } } as never);
      await next();
    }));
    app.use("*", csrfMiddleware);
    app.post("/auth/sign-in/email", (c) => c.text("ok"));

    const response = await app.request("http://localhost/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
