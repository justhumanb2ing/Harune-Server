import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { unauthorized, internalServerError } from "../lib/api-response";
import { getMe } from "../services/get-me";
import { getAnalytics } from "../services/get-analytics";
import type { MeResponse } from "../types/me";
import type { AppBindings } from "../types/app-bindings";
import type { ProfileAnalyticsResponse } from "../types/analytics";

type MeRouteDependencies = {
	getMe?: typeof getMe;
	getAnalytics?: typeof getAnalytics;
};

export function createMeRoute(dependencies: MeRouteDependencies = {}) {
	const getMeForUser = dependencies.getMe ?? getMe;
	const getAnalyticsForUser = dependencies.getAnalytics ?? getAnalytics;

	return new Hono<AppBindings>().get("/", async (c) => {
		const session = c.get("session");

		if (!session?.userId) {
			throw new HTTPException(401, {
				message: "authentication required",
				cause: { error: "unauthorized" },
			});
		}

		const db = c.get("db");
		return c.json<MeResponse>(await getMeForUser(db, session.userId));
	}).get("/analytics", async (c) => {
		const session = c.get("session");

		if (!session?.userId) {
			const response = unauthorized(c, "unauthorized", "authentication required");
			response.headers.set("Cache-Control", "no-store");
			return response;
		}

		try {
			const db = c.get("db");
			const response = c.json<ProfileAnalyticsResponse>(
				await getAnalyticsForUser(
					db,
					session.userId,
					{
						env: c.env,
						timezoneHeader: c.req.header("x-vercel-ip-timezone"),
					},
				),
			);

			response.headers.set("Cache-Control", "no-store");
			return response;
		} catch {
			const response = internalServerError(
				c,
				"profile_analytics_failed",
				"failed to load profile analytics",
			);
			response.headers.set("Cache-Control", "no-store");
			return response;
		}
	});
}

const meRoute = createMeRoute();

export default meRoute;
export type AppType = typeof meRoute;
