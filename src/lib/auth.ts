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
import { createDodoSubscriptionWebhookHandlers } from "../services/dodo-subscription-webhooks";
import type { AppBindings } from "../types/app-bindings";
import { createBackgroundTaskHandler } from "./background-tasks";
import { createDB } from "./db";
import { createDodoPaymentsClient } from "./dodo-payments";
import { jwtOptions } from "./jwt";
import { hashedPassword } from "./password";
import { sendResendEmail, sendResendTemplateEmail } from "./resend";

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

function getExecutionContext(c: Context<AppBindings>) {
	try {
		return c.executionCtx;
	} catch {
		return undefined;
	}
}

function queueEmailDelivery(
	c: Context<AppBindings>,
	promise: Promise<unknown>,
	label: string,
) {
	const executionCtx = getExecutionContext(c);

	if (executionCtx) {
		executionCtx.waitUntil(
			promise.catch((error) => {
				console.error(`Failed to send ${label}:`, error);
			}),
		);
		return;
	}

	void promise.catch((error) => {
		console.error(`Failed to send ${label}:`, error);
	});
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
	const dodoWebhookHandlers = createDodoSubscriptionWebhookHandlers(db);
	const resendApiKey = c.env.RESEND_API_KEY;
	const resendDeleteAccountTemplateId = c.env.RESEND_DELETE_ACCOUNT_TEMPLATE_ID;

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
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				queueEmailDelivery(
					c,
					sendResendEmail({
						apiKey: resendApiKey,
						from: c.env.RESEND_FROM_EMAIL,
						to: user.email,
						subject: "Verify your Harune email",
						headline: "Verify your Harune email",
						body: "Use the button below to confirm this email address and continue using Harune.",
						actionLabel: "Verify email",
						actionUrl: url,
					}),
					"email verification email",
				);
			},
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
			deleteUser: {
				enabled: true,
				sendDeleteAccountVerification: async ({ user, url }) => {
					queueEmailDelivery(
						c,
						sendResendTemplateEmail({
							apiKey: resendApiKey,
							from: c.env.RESEND_FROM_EMAIL,
							to: user.email,
							templateId: resendDeleteAccountTemplateId,
							variables: {
								ACTION_URL: url,
							},
						}),
						"delete account verification email",
					);
				},
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
				getCustomerParams: (user) => ({
					metadata: {
						userId: user.id,
					},
				}),
				use: [
					checkout({
						products: [
							{
								productId: "pdt_0NeW1WSlix31wIXxn1XCC",
								slug: "free",
							},
							{
								productId: "pdt_0NeT4l9x1OIj74GdAQvVH",
								slug: "pro",
							},
						],
						successUrl: getDodoPaymentsSuccessUrl(c),
						authenticatedUsersOnly: true,
					}),
					portal(),
					webhooks({
						webhookKey: c.env.DODO_PAYMENTS_WEBHOOK_SECRET,
						onPayload: async (payload) => {
							console.log(
								JSON.stringify({
									scope: "dodo_subscription_webhook",
									stage: "auth_webhook_received",
									eventType: payload.type,
									payloadType: payload.data?.payload_type ?? null,
								}),
							);
						},
						onPaymentSucceeded: dodoWebhookHandlers.onPaymentSucceeded,
						onSubscriptionActive: dodoWebhookHandlers.onSubscriptionActive,
						onSubscriptionUpdated: dodoWebhookHandlers.onSubscriptionUpdated,
						onSubscriptionRenewed: dodoWebhookHandlers.onSubscriptionRenewed,
						onSubscriptionPlanChanged:
							dodoWebhookHandlers.onSubscriptionPlanChanged,
						onSubscriptionOnHold: dodoWebhookHandlers.onSubscriptionOnHold,
						onSubscriptionCancelled:
							dodoWebhookHandlers.onSubscriptionCancelled,
						onSubscriptionExpired: dodoWebhookHandlers.onSubscriptionExpired,
						onSubscriptionFailed: dodoWebhookHandlers.onSubscriptionFailed,
					}),
				],
			}),
		],
	});
};
