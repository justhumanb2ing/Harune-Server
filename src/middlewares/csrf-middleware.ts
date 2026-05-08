import { csrf } from "hono/csrf";
import { getAllowedOrigins } from "../config/origins";

export const csrfMiddleware = csrf({
  origin: (origin, c) => {
    if (c.req.path === "/auth" || c.req.path.startsWith("/auth/")) {
      return true;
    }

    const allowedOrigins = getAllowedOrigins(c.env);
    return allowedOrigins.includes(origin);
  },
})
