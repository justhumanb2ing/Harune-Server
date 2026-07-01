import { Hono } from "hono";

import { getAllowedOrigins } from "../config/origins";
import { badRequest, notFound } from "../lib/api-response";
import { getAuth } from "../lib/auth";
import type { AppBindings } from "../types/app-bindings";

function getFallbackRedirectURL(c: { env?: AppBindings["Bindings"] }) {
	const appOrigin = c.env?.HARUNE_APP_ORIGIN ?? "http://localhost:3000";
	return new URL("/sign-in", appOrigin).toString();
}

function getSafeCallbackURL(
	c: {
		env: AppBindings["Bindings"];
	},
	callbackURL?: string,
) {
	const fallbackURL = getFallbackRedirectURL(c);

	if (!callbackURL) {
		return fallbackURL;
	}

	try {
		const parsed = new URL(callbackURL, fallbackURL);
		const allowedOrigins = new Set(getAllowedOrigins(c.env));

		if (allowedOrigins.has(parsed.origin)) {
			return parsed.toString();
		}
	} catch {
		// Fall through to the safe fallback below.
	}

	return fallbackURL;
}

export function createDeleteUserCallbackRoute() {
	return new Hono<AppBindings>().get("/", async (c) => {
		const token = c.req.query("token");

		if (!token?.trim()) {
			return badRequest(c, "validation_error", "token is required");
		}

		const auth = getAuth(c);
		const authContext = await auth.$context;
		const verification =
			await authContext.internalAdapter.findVerificationValue(
				`delete-account-${token}`,
			);

		if (!verification || verification.expiresAt < new Date()) {
			return notFound(c, "invalid_token", "invalid or expired deletion token");
		}

		const userId = verification.value;
		await authContext.internalAdapter.deleteUser(userId);
		await authContext.internalAdapter.deleteSessions(userId);
		await authContext.internalAdapter.deleteAccounts(userId);
		await authContext.internalAdapter.deleteVerificationByIdentifier(
			`delete-account-${token}`,
		);

		return c.redirect(getSafeCallbackURL(c, c.req.query("callbackURL")));
	});
}

const deleteUserCallbackRoute = createDeleteUserCallbackRoute();

export default deleteUserCallbackRoute;
export type AppType = typeof deleteUserCallbackRoute;
