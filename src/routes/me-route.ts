import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { getMe } from "../services/get-me";
import type { MeResponse } from "../types/me";
import type { AppBindings } from "../types/types";

type MeRouteDependencies = {
	getMe?: typeof getMe;
};

export function createMeRoute(dependencies: MeRouteDependencies = {}) {
	const getMeForUser = dependencies.getMe ?? getMe;

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
	});
}

const meRoute = createMeRoute();

export default meRoute;
export type AppType = typeof meRoute;
