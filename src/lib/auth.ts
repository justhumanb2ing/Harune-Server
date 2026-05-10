import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
	checkout,
	dodopayments,
	portal,
	webhooks,
} from "@dodopayments/better-auth";
import { betterAuth } from "better-auth/minimal";
import { jwt, openAPI } from "better-auth/plugins";
import type { Context } from "hono";
import { getAllowedOrigins } from "../config/origins";
import type { AppBindings } from "../types/app-bindings";
import { createBackgroundTaskHandler } from "./background-tasks";
import { createDB } from "./db";
import { createDodoPaymentsClient } from "./dodo-payments";
import { jwtOptions } from "./jwt";
import { hashedPassword } from "./password";

function isHaruneProductionAuthUrl(authUrl?: string) {
	return (
		authUrl?.startsWith("https://") === true &&
		new URL(authUrl).hostname.endsWith(".harune.me")
	);
}

function getDodoPaymentsSuccessUrl(c: Context<AppBindings>) {
	const appOrigin = c.env.HARUNE_APP_ORIGIN ?? "http://localhost:3000";

	return new URL("/payment/success", appOrigin).toString();
}

export function getAuthAdvancedConfig(c: Context<AppBindings>) {
	const isProductionAuthUrl = isHaruneProductionAuthUrl(c.env.BETTER_AUTH_URL);

	return isProductionAuthUrl
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

export const createAuth = (c: Context<AppBindings>) => {
	const dodoPaymentsClient = createDodoPaymentsClient(c);
	const db = createDB(c);

	return betterAuth({
		appName: "Harune",
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL ?? "http://localhost:8787",
		basePath: "/auth",
		trustedOrigins: getAllowedOrigins(c.env),
		database: drizzleAdapter(db, {
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
		databaseHooks: {
			user: {
				create: {
					before: async (user) => ({
						data: {
							...user,
							emailVerified: true,
						},
					}),
				},
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

		plugins: [
			jwt(jwtOptions),
			openAPI(),
			dodopayments({
				client: dodoPaymentsClient,
				createCustomerOnSignUp: true,
				use: [
					checkout({
						products: [
							{
								productId: "pdt_0NeW1WSlix31wIXxn1XCC",
								slug: "free-plan",
							},
							{
								productId: "pdt_0NeT4l9x1OIj74GdAQvVH",
								slug: "pro-plan",
							},
						],
						successUrl: getDodoPaymentsSuccessUrl(c),
						authenticatedUsersOnly: true,
					}),
					portal(),
					webhooks({
						webhookKey: c.env.DODO_PAYMENTS_WEBHOOK_SECRET,
						onPayload: async (payload) => {
							console.log("Received webhook: ", payload.type);
						},
					}),
				],
			}),
		],
	});
};
