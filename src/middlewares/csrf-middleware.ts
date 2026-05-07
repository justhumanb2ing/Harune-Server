import { csrf } from "hono/csrf";
import { getAllowedOrigins } from "../config/origins";

export const csrfMiddleware = csrf({
  origin: (origin, c) => {
    const allowedOrigins = getAllowedOrigins(c.env);
    return allowedOrigins.includes(origin);
  },
})
