import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { jwt, openAPI } from "better-auth/plugins";
import type { Context } from "hono";
import { getAllowedOrigins } from "../config/origins";
import type { AppBindings } from "../types/app-bindings";
import { createBackgroundTaskHandler } from "./background-tasks";
import { createDB } from "./db";
import { jwtOptions } from "./jwt";
import { hashedPassword } from "./password";

export function getAuthAdvancedConfig(c: Context<AppBindings>) {
	const authUrl = c.env.BETTER_AUTH_URL;
	const isHaruneProductionAuthUrl =
		authUrl?.startsWith("https://") &&
		new URL(authUrl).hostname.endsWith(".harune.me");

	return isHaruneProductionAuthUrl
		? {
				backgroundTasks: {
					handler: createBackgroundTaskHandler(c),
				},
				crossSubDomainCookies: {
					enabled: true,
					domain: ".harune.me",
				},
				ipAddress: {
					ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
				},
			}
		: undefined;
}

export const createAuth = (c: Context<AppBindings>) =>
	betterAuth({
		appName: "Harune",
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL ?? "http://localhost:8787",
		basePath: "/auth",
		trustedOrigins: getAllowedOrigins(c.env),
		database: drizzleAdapter(createDB(c), {
			provider: "pg",
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			password: hashedPassword,
		},
		socialProviders: {
			google: {
				clientId: c.env.GOOGLE_CLIENT_ID as string,
				clientSecret: c.env.GOOGLE_CLIENT_SECRET as string,
			},
		},
		user: {
			fields: {
				emailVerified: "emailVerifiedBool",
			},
		},
		account: {
			storeStateStrategy: "database",
			accountLinking: {
				enabled: true,
				trustedProviders: ["google", "email-password"],
			},
		},
		session: {
			freshAge: 60 * 60 * 24 * 7,
			cookieCache: {
				enabled: false,
				maxAge: 60 * 5,
			},
			deferSessionRefresh: true,
		},
		advanced: getAuthAdvancedConfig(c),

		plugins: [jwt(jwtOptions), openAPI()],
	});
