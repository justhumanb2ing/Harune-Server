import type { Hyperdrive, R2Bucket } from "@cloudflare/workers-types";
import { Session, User } from "better-auth";
import { Env } from "hono";
import type { Pool } from "pg";

import { createAuth } from "../lib/auth";
import { createDB } from "../lib/db";

export interface AppBindings extends Env {
	Bindings: {
		BETTER_AUTH_SECRET: string;
		BETTER_AUTH_URL?: string;
		FRONTEND_URL?: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		HYPERDRIVE: Hyperdrive;
		UMAMI_SCRIPT_SRC?: string;
		UMAMI_WEBSITE_ID?: string;
		R2_BUCKET: R2Bucket;
		UMAMI_API_ENDPOINT?: string;
		UMAMI_API_KEY?: string;
		UMAMI_API_TOKEN?: string;
		UPSTASH_DISABLE_TELEMETRY?: string;
		UPSTASH_REDIS_REST_TOKEN?: string;
		UPSTASH_REDIS_REST_URL?: string;
	};
	Variables: {
		auth: ReturnType<typeof createAuth>;
		db: ReturnType<typeof createDB>;
		dbPool: Pool;
		session: Session | null;
		user: User | null;
	};
}
