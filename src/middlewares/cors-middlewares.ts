import { cors } from "hono/cors";
import { getAllowedOrigins } from "../config/origins";

export const corsMiddleware = cors({
  origin: (origin, c) => {
    const allowedOrigins = getAllowedOrigins(c.env);
    return allowedOrigins.includes(origin) ? origin : null;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
})
