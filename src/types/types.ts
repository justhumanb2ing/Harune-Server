import type { Hyperdrive, R2Bucket } from "@cloudflare/workers-types";
import { Env } from "hono";
import { Session, User } from "better-auth";
import { createAuth } from "../lib/auth";
import { createDB } from "../lib/db";
import type { Pool } from "pg";

export interface AppBindings extends Env {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
    R2_BUCKET: R2Bucket;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL?: string;
    FRONTEND_URL?: string;
    UPSTASH_REDIS_REST_URL?: string
    UPSTASH_REDIS_REST_TOKEN?: string
    UPSTASH_DISABLE_TELEMETRY?: string
  };
  Variables: {
    auth: ReturnType<typeof createAuth>;
    db: ReturnType<typeof createDB>;
    dbPool: Pool;
    session: Session | null;
    user: User | null;
  };
}
