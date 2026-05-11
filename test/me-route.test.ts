import { describe, expect, it } from "vitest";
import { Hono } from "hono";

import { handleHonoError } from "../src/lib/error-utils";
import { createMeRoute } from "../src/routes/me-route";
import type { ProfileAnalyticsResponse } from "../src/types/analytics";
import type { AppBindings } from "../src/types/app-bindings";

type SessionState = {
	userId: string;
} | null;

function createTestApp({
	session,
	meResponse,
	analyticsError,
	analyticsResponse,
}: {
	session: SessionState;
	meResponse?: unknown;
	analyticsError?: Error;
	analyticsResponse?: unknown;
}) {
	const route = createMeRoute({
		getMe: async () => meResponse as never,
		getAnalytics: async () => {
			if (analyticsError) {
				throw analyticsError;
			}

			return analyticsResponse as never;
		},
	});

	const app = new Hono<AppBindings>();
	app.use("*", async (c, next) => {
		c.set("db", {} as never);
		c.set("session", session as never);
		await next();
	});
	app.onError(handleHonoError);
	app.route("/me", route);
	app.route("/users/me", route);

	return app;
}

describe("GET /me", () => {
	it("returns 401 when no session exists", async () => {
		const app = createTestApp({ session: null });

		const response = await app.request("/me");

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "authentication required",
			},
		});
	});

	it("returns the me response for the current user", async () => {
		const app = createTestApp({
			session: { userId: "user-1" },
			meResponse: {
				currentPlan: {
					id: "plan-1",
					name: "Pro",
					codename: "pro",
					quotas: { seats: 3 },
					default: false,
				},
				profilePage: {
					id: "page-1",
					handle: "maker",
					name: "Maker",
					image: "https://example.com/avatar.png",
				},
				user: {
					id: "user-1",
					email: "user@example.com",
					name: "User",
					image: null,
					createdAt: "2026-05-07T00:00:00.000Z",
					updatedAt: "2026-05-07T00:00:00.000Z",
					planId: "plan-1",
					credits: { upload: 12 },
				},
			},
		});

		const response = await app.request("/users/me");
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			currentPlan: {
				id: "plan-1",
				name: "Pro",
				codename: "pro",
				quotas: { seats: 3 },
				default: false,
			},
			profilePage: {
				id: "page-1",
				handle: "maker",
				name: "Maker",
				image: "https://example.com/avatar.png",
			},
			user: {
				id: "user-1",
				email: "user@example.com",
				name: "User",
				image: null,
				createdAt: "2026-05-07T00:00:00.000Z",
				updatedAt: "2026-05-07T00:00:00.000Z",
				planId: "plan-1",
				credits: { upload: 12 },
			},
		});
	});

	it("returns the analytics response for the current user and disables caching", async () => {
		const analyticsResponse = {
			profilePageId: "page-1",
			state: "ready",
			summaries: {},
			timezone: "Asia/Seoul",
		} as unknown as ProfileAnalyticsResponse;
		const app = createTestApp({
			analyticsResponse,
			meResponse: {},
			session: { userId: "user-1" },
		});

		const response = await app.request("/me/analytics", {
			headers: {
				"x-vercel-ip-timezone": "Asia/Seoul",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual(analyticsResponse);
	});

	it("returns 401 when analytics is requested without a session", async () => {
		const app = createTestApp({
			session: null,
		});

		const response = await app.request("/users/me/analytics");

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "authentication required",
			},
		});
	});

	it("maps analytics errors to the existing JSON error contract", async () => {
		const app = createTestApp({
			analyticsError: new Error("analytics unavailable"),
			session: { userId: "user-1" },
		});

		const response = await app.request("/me/analytics");
		const json = await response.json();

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual({
			error: {
				code: "profile_analytics_failed",
				message: "failed to load profile analytics",
			},
		});
	});
});
