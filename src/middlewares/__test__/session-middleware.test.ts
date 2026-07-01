import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import honoFactory from "../../hono-factory";
import type { AppBindings } from "../../types/app-bindings";
import { sessionMiddleware } from "../session-middleware";

describe("sessionMiddleware", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("skips auth routes to avoid re-running Better Auth during sign-in and callbacks", async () => {
		const getSession = vi.fn(async () => ({ user: null, session: null }));

		const app = new Hono<AppBindings>();
		app.use(
			"*",
			honoFactory.createMiddleware(async (c, next) => {
				c.set("auth", { api: { getSession } } as never);
				await next();
			}),
		);
		app.use("*", sessionMiddleware);
		app.get("/auth/sign-in/email", (c) => c.text("ok"));

		const response = await app.request("http://localhost/auth/sign-in/email");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
		expect(getSession).not.toHaveBeenCalled();
	});

	it("continues to resolve sessions for non-auth routes when cookies are present", async () => {
		const getSession = vi.fn(async () => ({
			user: { id: "user-1" },
			session: { userId: "user-1" },
		}));

		const app = new Hono<AppBindings>();
		app.use(
			"*",
			honoFactory.createMiddleware(async (c, next) => {
				c.set("auth", { api: { getSession } } as never);
				await next();
			}),
		);
		app.use("*", sessionMiddleware);
		app.get("/me", (c) => {
			const session = c.get("session");
			const user = c.get("user");

			return c.json({ session, user });
		});

		const response = await app.request("http://localhost/me", {
			headers: {
				cookie: "better-auth.session_token=test",
			},
		});

		expect(response.status).toBe(200);
		expect(getSession).toHaveBeenCalledTimes(1);
		expect(await response.json()).toEqual({
			session: { userId: "user-1" },
			user: { id: "user-1" },
		});
	});

	it("skips session lookups for anonymous requests without cookies", async () => {
		const getSession = vi.fn(async () => ({ user: null, session: null }));

		const app = new Hono<AppBindings>();
		app.use(
			"*",
			honoFactory.createMiddleware(async (c, next) => {
				c.set("auth", { api: { getSession } } as never);
				await next();
			}),
		);
		app.use("*", sessionMiddleware);
		app.get("/profile/maker", (c) => {
			const session = c.get("session");
			const user = c.get("user");

			return c.json({ session, user });
		});

		const response = await app.request("http://localhost/profile/maker");

		expect(response.status).toBe(200);
		expect(getSession).not.toHaveBeenCalled();
		expect(await response.json()).toEqual({
			session: null,
			user: null,
		});
	});

	it("still resolves sessions for requests carrying cookies", async () => {
		const getSession = vi.fn(async () => ({
			user: { id: "user-1" },
			session: { userId: "user-1" },
		}));

		const app = new Hono<AppBindings>();
		app.use(
			"*",
			honoFactory.createMiddleware(async (c, next) => {
				c.set("auth", { api: { getSession } } as never);
				await next();
			}),
		);
		app.use("*", sessionMiddleware);
		app.get("/profile/maker", (c) => {
			const session = c.get("session");
			const user = c.get("user");

			return c.json({ session, user });
		});

		const response = await app.request("http://localhost/profile/maker", {
			headers: {
				cookie: "better-auth.session_token=test",
			},
		});

		expect(response.status).toBe(200);
		expect(getSession).toHaveBeenCalledTimes(1);
		expect(await response.json()).toEqual({
			session: { userId: "user-1" },
			user: { id: "user-1" },
		});
	});
});
