import type { Hyperdrive, R2Bucket } from "@cloudflare/workers-types";
import { Session, User } from "better-auth";
import { Env } from "hono";

import { createAuth } from "../lib/auth";
import { createDB } from "../lib/db";

export interface AppBindings extends Env {
	Bindings: {
		BETTER_AUTH_SECRET: string;
		BETTER_AUTH_URL?: string;
		FRONTEND_URL?: string;
		HARUNE_APP_ORIGIN?: string;
		GOOGLE_CLIENT_ID: string;
		GOOGLE_CLIENT_SECRET: string;
		HYPERDRIVE: Hyperdrive;
		UMAMI_SCRIPT_SRC?: string;
		UMAMI_WEBSITE_ID?: string;
		R2_ACCOUNT_ID: string;
		R2_ACCESS_KEY_ID: string;
		R2_SECRET_ACCESS_KEY: string;
		PROFILE_MEDIA_BUCKET_NAME: string;
		PROFILE_MEDIA_BUCKET: R2Bucket;
		R2_PUBLIC_BASE_URL: string;
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
		session: Session | null;
		user: User | null;
	};
}
