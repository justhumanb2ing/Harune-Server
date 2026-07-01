import honoFactory from "../hono-factory";
import { getAuth } from "../lib/auth";

function hasSessionCookie(cookieHeader: string | undefined) {
	if (!cookieHeader) {
		return false;
	}

	return /(^|;\s*)(__Secure-)?better-auth\.[^=]+=/.test(cookieHeader);
}

export const sessionMiddleware = honoFactory.createMiddleware(
	async (c, next) => {
		if (c.req.path === "/auth" || c.req.path.startsWith("/auth/")) {
			c.set("session", null);
			c.set("user", null);
			await next();
			return;
		}

		if (!hasSessionCookie(c.req.header("cookie"))) {
			c.set("session", null);
			c.set("user", null);
			await next();
			return;
		}

		const auth = getAuth(c);
		const userSession = await auth.api.getSession({
			headers: c.req.raw.headers,
		});

		const { user, session } = userSession ?? { user: null, session: null };
		c.set("user", user);
		c.set("session", session);
		await next();
	},
);
