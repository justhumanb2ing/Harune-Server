import { HTTPException } from "hono/http-exception";

import type { Database } from "../lib/db";
import {
	type DodoSubscriptionPlanRow,
	type DodoSubscriptionUserRow,
	findDefaultPlan,
	findPlanByMonthlyDodoProductId,
	findUserByDodoCustomerId,
	findUserByDodoSubscriptionId,
	findUserByEmail,
	findUserById,
	updateUserSubscriptionStateById,
} from "../repositories/dodo-subscription-repository";

type DodoSubscriptionWebhookData = {
	customer_id?: string | null;
	customer?: {
		customer_id?: string | null;
		email?: string | null;
		metadata?: Record<string, string> | null;
	} | null;
	metadata?: Record<string, string> | null;
	product_id?: string | null;
	productIds?: string[];
	product_cart?: Array<{
		product_id?: string | null;
		quantity?: number | null;
	}> | null;
	subscription_id?: string | null;
	status?:
		| "active"
		| "cancelled"
		| "on_hold"
		| "pending"
		| "failed"
		| "expired"
		| null;
	cancel_at_next_billing_date?: boolean | null;
	next_billing_date?: Date | string | null;
	cancelled_at?: Date | string | null;
	expires_at?: Date | string | null;
};

type DodoSubscriptionWebhookPayload = {
	business_id?: string;
	data?: DodoSubscriptionWebhookData | null;
	event_type?: string;
	timestamp?: string;
	type?: string;
};

type DodoSubscriptionWebhookDependencies = {
	findUserByDodoCustomerId?: typeof findUserByDodoCustomerId;
	findUserByDodoSubscriptionId?: typeof findUserByDodoSubscriptionId;
	findUserById?: typeof findUserById;
	findUserByEmail?: typeof findUserByEmail;
	findPlanByMonthlyDodoProductId?: typeof findPlanByMonthlyDodoProductId;
	findDefaultPlan?: typeof findDefaultPlan;
	updateUserSubscriptionStateById?: typeof updateUserSubscriptionStateById;
};

type ResolvedSubscriptionContext = {
	user: DodoSubscriptionUserRow;
	customerId: string | null;
	customerUserId: string | null;
	customerEmail: string | null;
	subscriptionId: string | null;
	productId: string | null;
	productIds: string[];
	status: DodoSubscriptionWebhookData["status"];
	cancelAtNextBillingDate: boolean | null;
	nextBillingDate: Date | null;
	cancelledAt: Date | null;
	expiresAt: Date | null;
};

function throwWebhookError(
	status: 400 | 404 | 500,
	code: string,
	message: string,
): never {
	throw new HTTPException(status, {
		message,
		cause: { error: code },
	});
}

function logDodoWebhook(
	stage: string,
	details: Record<string, unknown> = {},
): void {
	console.log(
		JSON.stringify({
			scope: "dodo_subscription_webhook",
			stage,
			...details,
		}),
	);
}

function maskEmail(value: string | null): string | null {
	if (!value) {
		return null;
	}

	const [localPart, domain] = value.split("@");
	if (!localPart || !domain) {
		return "[invalid-email]";
	}

	return `${localPart.slice(0, 2)}***@${domain}`;
}

function getPayloadRecord(payload: unknown): Record<string, unknown> | null {
	return payload && typeof payload === "object"
		? (payload as Record<string, unknown>)
		: null;
}

function parseDate(value: Date | string | null | undefined): Date | null {
	if (!value) {
		return null;
	}

	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const parsed = new Date(value);

	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeWebhookData(
	payload: DodoSubscriptionWebhookPayload | unknown,
): DodoSubscriptionWebhookData | null {
	const record = getPayloadRecord(payload);
	if (!record) {
		return null;
	}

	const data = getPayloadRecord(record.data) ?? record;

	const dataRecord = data;
	const customer = dataRecord.customer;
	const customerRecord =
		customer && typeof customer === "object"
			? (customer as Record<string, unknown>)
			: null;
	const nestedCustomerId =
		typeof customerRecord?.customer_id === "string"
			? customerRecord.customer_id
			: null;
	const nestedCustomerEmail =
		typeof customerRecord?.email === "string" ? customerRecord.email : null;
	const nestedCustomerMetadata =
		customerRecord?.metadata && typeof customerRecord.metadata === "object"
			? Object.fromEntries(
					Object.entries(
						customerRecord.metadata as Record<string, unknown>,
					).flatMap(([key, value]) =>
						typeof value === "string" ? [[key, value]] : [],
					),
				)
			: null;
	const metadata =
		dataRecord.metadata && typeof dataRecord.metadata === "object"
			? Object.fromEntries(
					Object.entries(
						dataRecord.metadata as Record<string, unknown>,
					).flatMap(([key, value]) =>
						typeof value === "string" ? [[key, value]] : [],
					),
				)
			: null;
	const productCart = Array.isArray(dataRecord.product_cart)
		? dataRecord.product_cart
				.map((item) => {
					if (!item || typeof item !== "object") {
						return null;
					}

					const itemRecord = item as Record<string, unknown>;
					return typeof itemRecord.product_id === "string"
						? {
								product_id: itemRecord.product_id,
								quantity:
									typeof itemRecord.quantity === "number"
										? itemRecord.quantity
										: null,
							}
						: null;
				})
				.filter(
					(item): item is { product_id: string; quantity: number | null } =>
						item !== null,
				)
		: null;
	const productIds = [
		typeof dataRecord.product_id === "string" ? dataRecord.product_id : null,
		...(productCart?.map((item) => item.product_id) ?? []),
	].filter((value): value is string => Boolean(value));

	return {
		customer_id:
			typeof dataRecord.customer_id === "string"
				? dataRecord.customer_id
				: nestedCustomerId,
		customer:
			nestedCustomerId || nestedCustomerEmail || nestedCustomerMetadata
				? {
						customer_id: nestedCustomerId,
						email: nestedCustomerEmail,
						metadata: nestedCustomerMetadata,
					}
				: null,
		metadata,
		product_id: productIds[0] ?? null,
		productIds,
		product_cart: productCart,
		subscription_id:
			typeof dataRecord.subscription_id === "string"
				? dataRecord.subscription_id
				: null,
		status:
			typeof dataRecord.status === "string"
				? (dataRecord.status as DodoSubscriptionWebhookData["status"])
				: null,
		cancel_at_next_billing_date:
			typeof dataRecord.cancel_at_next_billing_date === "boolean"
				? dataRecord.cancel_at_next_billing_date
				: null,
		next_billing_date: parseDateInput(dataRecord.next_billing_date),
		cancelled_at: parseDateInput(dataRecord.cancelled_at),
		expires_at: parseDateInput(dataRecord.expires_at),
	};
}

function parseDateInput(value: unknown): Date | string | null {
	return typeof value === "string" || value instanceof Date ? value : null;
}

function describeNormalizedData(data: DodoSubscriptionWebhookData | null) {
	if (!data) {
		return { normalized: false };
	}

	return {
		normalized: true,
		customerId: extractCustomerId(data),
		customerEmail: maskEmail(extractCustomerEmail(data)),
		customerUserId: extractCustomerUserId(data),
		subscriptionId: extractSubscriptionId(data),
		productId: extractProductId(data),
		productIds: data.productIds ?? [],
		status: data.status ?? null,
		cancelAtNextBillingDate: data.cancel_at_next_billing_date ?? null,
		nextBillingDate: parseDate(data.next_billing_date)?.toISOString() ?? null,
		cancelledAt: parseDate(data.cancelled_at)?.toISOString() ?? null,
		expiresAt: parseDate(data.expires_at)?.toISOString() ?? null,
	};
}

function describePayload(payload: unknown) {
	const record = getPayloadRecord(payload);
	const dataRecord = getPayloadRecord(record?.data);

	return {
		eventType: record?.type ?? record?.event_type ?? null,
		payloadType: dataRecord?.payload_type ?? record?.payload_type ?? null,
		hasDataWrapper: Boolean(dataRecord),
		topLevelKeys: record ? Object.keys(record).sort() : [],
		dataKeys: dataRecord ? Object.keys(dataRecord).sort() : [],
	};
}

function extractCustomerId(data: DodoSubscriptionWebhookData): string | null {
	return data.customer_id ?? data.customer?.customer_id ?? null;
}

function extractCustomerEmail(
	data: DodoSubscriptionWebhookData,
): string | null {
	return data.customer?.email ?? null;
}

function extractCustomerUserId(
	data: DodoSubscriptionWebhookData,
): string | null {
	return (
		data.metadata?.userId ??
		data.metadata?.user_id ??
		data.metadata?.referenceId ??
		data.customer?.metadata?.userId ??
		data.customer?.metadata?.user_id ??
		data.customer?.metadata?.referenceId ??
		null
	);
}

function extractProductId(data: DodoSubscriptionWebhookData): string | null {
	return data.product_id ?? null;
}

function extractSubscriptionId(
	data: DodoSubscriptionWebhookData,
): string | null {
	return data.subscription_id ?? null;
}

async function resolveSubscriptionContext(
	db: Database,
	payload: DodoSubscriptionWebhookPayload | unknown,
	dependencies: DodoSubscriptionWebhookDependencies,
): Promise<ResolvedSubscriptionContext> {
	const data = normalizeWebhookData(payload);
	logDodoWebhook("payload_received", {
		...describePayload(payload),
		...describeNormalizedData(data),
	});

	if (!data) {
		logDodoWebhook("payload_invalid", describePayload(payload));
		throwWebhookError(400, "dodo_webhook_payload_invalid", "invalid payload");
	}

	const customerId = extractCustomerId(data);
	const subscriptionId = extractSubscriptionId(data);
	const productId = extractProductId(data);
	const productIds = data.productIds ?? (productId ? [productId] : []);

	let user: DodoSubscriptionUserRow | null = null;

	if (customerId) {
		logDodoWebhook("user_lookup_started", {
			strategy: "dodoCustomerId",
			customerId,
		});
		user = await (
			dependencies.findUserByDodoCustomerId ?? findUserByDodoCustomerId
		)(db, customerId);
		logDodoWebhook("user_lookup_finished", {
			strategy: "dodoCustomerId",
			customerId,
			found: Boolean(user),
			userId: user?.id ?? null,
			planId: user?.planId ?? null,
		});
	}

	if (!user && subscriptionId) {
		logDodoWebhook("user_lookup_started", {
			strategy: "dodoSubscriptionId",
			subscriptionId,
		});
		user = await (
			dependencies.findUserByDodoSubscriptionId ?? findUserByDodoSubscriptionId
		)(db, subscriptionId);
		logDodoWebhook("user_lookup_finished", {
			strategy: "dodoSubscriptionId",
			subscriptionId,
			found: Boolean(user),
			userId: user?.id ?? null,
			planId: user?.planId ?? null,
		});
	}

	if (!user) {
		const customerUserId = extractCustomerUserId(data);
		if (customerUserId) {
			logDodoWebhook("user_lookup_started", {
				strategy: "customerMetadataUserId",
				customerUserId,
			});
			user = await (dependencies.findUserById ?? findUserById)(
				db,
				customerUserId,
			);
			logDodoWebhook("user_lookup_finished", {
				strategy: "customerMetadataUserId",
				customerUserId,
				found: Boolean(user),
				userId: user?.id ?? null,
				planId: user?.planId ?? null,
			});
		}
	}

	if (!user) {
		const customerEmail = extractCustomerEmail(data);
		if (customerEmail) {
			logDodoWebhook("user_lookup_started", {
				strategy: "customerEmail",
				customerEmail: maskEmail(customerEmail),
			});
			user = await (dependencies.findUserByEmail ?? findUserByEmail)(
				db,
				customerEmail,
			);
			logDodoWebhook("user_lookup_finished", {
				strategy: "customerEmail",
				customerEmail: maskEmail(customerEmail),
				found: Boolean(user),
				userId: user?.id ?? null,
				planId: user?.planId ?? null,
			});
		}
	}

	if (!user) {
		logDodoWebhook("user_lookup_failed", {
			customerId,
			subscriptionId,
			customerUserId: extractCustomerUserId(data),
			customerEmail: maskEmail(extractCustomerEmail(data)),
		});
		throwWebhookError(
			404,
			"dodo_user_not_found",
			"matching user not found for subscription event",
		);
	}

	const context = {
		user,
		customerId,
		customerUserId: extractCustomerUserId(data),
		customerEmail: extractCustomerEmail(data),
		subscriptionId,
		productId,
		productIds,
		status: data.status ?? null,
		cancelAtNextBillingDate: data.cancel_at_next_billing_date ?? null,
		nextBillingDate: parseDate(data.next_billing_date),
		cancelledAt: parseDate(data.cancelled_at),
		expiresAt: parseDate(data.expires_at),
	};
	logDodoWebhook("context_resolved", {
		userId: user.id,
		userPlanId: user.planId,
		customerId,
		subscriptionId,
		productId,
		productIds,
		status: data.status ?? null,
		nextBillingDate: parseDate(data.next_billing_date)?.toISOString() ?? null,
		cancelledAt: parseDate(data.cancelled_at)?.toISOString() ?? null,
		expiresAt: parseDate(data.expires_at)?.toISOString() ?? null,
	});

	return context;
}

async function resolvePlanForProducts(
	db: Database,
	productIds: string[],
	dependencies: DodoSubscriptionWebhookDependencies,
): Promise<DodoSubscriptionPlanRow | null> {
	for (const productId of productIds) {
		logDodoWebhook("plan_lookup_started", { productId });
		const plan = await (
			dependencies.findPlanByMonthlyDodoProductId ??
			findPlanByMonthlyDodoProductId
		)(db, productId);
		logDodoWebhook("plan_lookup_finished", {
			productId,
			found: Boolean(plan),
			planId: plan?.id ?? null,
			planCodename: plan?.codename ?? null,
		});

		if (plan) {
			return plan;
		}
	}

	return null;
}

async function getFallbackPlan(
	db: Database,
	dependencies: DodoSubscriptionWebhookDependencies,
): Promise<DodoSubscriptionPlanRow | null> {
	logDodoWebhook("fallback_plan_lookup_started");
	const plan =
		(await (dependencies.findDefaultPlan ?? findDefaultPlan)(db)) ?? null;
	logDodoWebhook("fallback_plan_lookup_finished", {
		found: Boolean(plan),
		planId: plan?.id ?? null,
		planCodename: plan?.codename ?? null,
	});

	return plan;
}

function serializePatch(input: {
	planId?: string | null;
	dodoCustomerId?: string | null;
	dodoSubscriptionId?: string | null;
	dodoSubscriptionAccessUntilAt?: Date | null;
}) {
	return {
		...input,
		dodoSubscriptionAccessUntilAt:
			input.dodoSubscriptionAccessUntilAt?.toISOString() ??
			input.dodoSubscriptionAccessUntilAt ??
			null,
	};
}

async function setUserPlan(
	db: Database,
	userId: string,
	input: {
		planId?: string | null;
		dodoCustomerId?: string | null;
		dodoSubscriptionId?: string | null;
		dodoSubscriptionAccessUntilAt?: Date | null;
	},
	dependencies: DodoSubscriptionWebhookDependencies,
) {
	logDodoWebhook("user_update_started", {
		userId,
		patch: serializePatch(input),
	});
	const updated = await (
		dependencies.updateUserSubscriptionStateById ??
		updateUserSubscriptionStateById
	)(db, userId, input);

	if (!updated) {
		logDodoWebhook("user_update_failed", {
			userId,
			patch: serializePatch(input),
		});
		throwWebhookError(
			500,
			"dodo_user_update_failed",
			"failed to update subscription state",
		);
	}

	logDodoWebhook("user_update_finished", {
		userId: updated.id,
		planId: updated.planId,
		dodoCustomerId: updated.dodoCustomerId,
		dodoSubscriptionId: updated.dodoSubscriptionId,
		dodoSubscriptionAccessUntilAt:
			updated.dodoSubscriptionAccessUntilAt?.toISOString() ?? null,
	});

	return updated;
}

function buildSubscriptionPatch(
	context: ResolvedSubscriptionContext,
	input: {
		planId: string | null;
		dodoSubscriptionAccessUntilAt?: Date | null;
	},
) {
	const patch: {
		planId: string | null;
		dodoCustomerId: string | null;
		dodoSubscriptionId: string | null;
		dodoSubscriptionAccessUntilAt?: Date | null;
	} = {
		planId: input.planId,
		dodoCustomerId: context.customerId ?? context.user.dodoCustomerId,
		dodoSubscriptionId:
			context.subscriptionId ?? context.user.dodoSubscriptionId,
	};

	if (input.dodoSubscriptionAccessUntilAt !== undefined) {
		patch.dodoSubscriptionAccessUntilAt = input.dodoSubscriptionAccessUntilAt;
	}

	return patch;
}

async function syncSubscriptionPlan(
	db: Database,
	payload: DodoSubscriptionWebhookPayload | unknown,
	dependencies: DodoSubscriptionWebhookDependencies,
) {
	logDodoWebhook("sync_started", describePayload(payload));
	const context = await resolveSubscriptionContext(db, payload, dependencies);
	const matchedPlan = context.productIds.length
		? await resolvePlanForProducts(db, context.productIds, dependencies)
		: null;
	const fallbackPlan = context.productIds.length
		? null
		: await getFallbackPlan(db, dependencies);

	if (context.productIds.length > 0 && !matchedPlan) {
		logDodoWebhook("plan_lookup_failed", {
			userId: context.user.id,
			productIds: context.productIds,
		});
		throwWebhookError(
			500,
			"dodo_plan_not_found",
			"matching plan not found for subscription product",
		);
	}

	const patch = buildSubscriptionPatch(context, {
		planId: matchedPlan?.id ?? context.user.planId ?? fallbackPlan?.id ?? null,
		dodoSubscriptionAccessUntilAt: context.nextBillingDate ?? null,
	});

	await setUserPlan(db, context.user.id, patch, dependencies);
	logDodoWebhook("sync_finished", {
		userId: context.user.id,
		planId: patch.planId,
		dodoCustomerId: patch.dodoCustomerId,
		dodoSubscriptionId: patch.dodoSubscriptionId,
	});
}

async function handleSubscriptionCancelled(
	db: Database,
	payload: DodoSubscriptionWebhookPayload | unknown,
	dependencies: DodoSubscriptionWebhookDependencies,
) {
	logDodoWebhook("cancelled_started", describePayload(payload));
	const context = await resolveSubscriptionContext(db, payload, dependencies);

	await setUserPlan(
		db,
		context.user.id,
		buildSubscriptionPatch(context, {
			planId: context.user.planId,
			dodoSubscriptionAccessUntilAt:
				context.nextBillingDate ?? context.expiresAt ?? context.cancelledAt,
		}),
		dependencies,
	);
	logDodoWebhook("cancelled_finished", {
		userId: context.user.id,
		planId: context.user.planId,
		accessUntil:
			(
				context.nextBillingDate ??
				context.expiresAt ??
				context.cancelledAt
			)?.toISOString() ?? null,
	});
}

async function handleSubscriptionExpired(
	db: Database,
	payload: DodoSubscriptionWebhookPayload | unknown,
	dependencies: DodoSubscriptionWebhookDependencies,
) {
	logDodoWebhook("expired_started", describePayload(payload));
	const context = await resolveSubscriptionContext(db, payload, dependencies);
	const fallbackPlan = await getFallbackPlan(db, dependencies);

	await setUserPlan(
		db,
		context.user.id,
		buildSubscriptionPatch(context, {
			planId: fallbackPlan?.id ?? null,
			dodoSubscriptionAccessUntilAt: null,
		}),
		dependencies,
	);
	logDodoWebhook("expired_finished", {
		userId: context.user.id,
		planId: fallbackPlan?.id ?? null,
	});
}

async function handleSubscriptionOnHold(
	db: Database,
	payload: DodoSubscriptionWebhookPayload | unknown,
	dependencies: DodoSubscriptionWebhookDependencies,
) {
	logDodoWebhook("on_hold_started", describePayload(payload));
	const context = await resolveSubscriptionContext(db, payload, dependencies);
	const fallbackPlan = await getFallbackPlan(db, dependencies);

	await setUserPlan(
		db,
		context.user.id,
		buildSubscriptionPatch(context, {
			planId: fallbackPlan?.id ?? null,
			dodoSubscriptionAccessUntilAt: null,
		}),
		dependencies,
	);
	logDodoWebhook("on_hold_finished", {
		userId: context.user.id,
		planId: fallbackPlan?.id ?? null,
	});
}

async function handleSubscriptionFailed(
	db: Database,
	payload: DodoSubscriptionWebhookPayload | unknown,
	dependencies: DodoSubscriptionWebhookDependencies,
) {
	logDodoWebhook("failed_started", describePayload(payload));
	const context = await resolveSubscriptionContext(db, payload, dependencies);
	const fallbackPlan = await getFallbackPlan(db, dependencies);

	await setUserPlan(
		db,
		context.user.id,
		buildSubscriptionPatch(context, {
			planId: fallbackPlan?.id ?? null,
			dodoSubscriptionAccessUntilAt: null,
		}),
		dependencies,
	);
	logDodoWebhook("failed_finished", {
		userId: context.user.id,
		planId: fallbackPlan?.id ?? null,
	});
}

export function createDodoSubscriptionWebhookHandlers(
	db: Database,
	dependencies: DodoSubscriptionWebhookDependencies = {},
) {
	return {
		onPaymentSucceeded: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await syncSubscriptionPlan(db, payload, dependencies);
		},
		onSubscriptionActive: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await syncSubscriptionPlan(db, payload, dependencies);
		},
		onSubscriptionUpdated: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await syncSubscriptionPlan(db, payload, dependencies);
		},
		onSubscriptionRenewed: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await syncSubscriptionPlan(db, payload, dependencies);
		},
		onSubscriptionPlanChanged: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await syncSubscriptionPlan(db, payload, dependencies);
		},
		onSubscriptionOnHold: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await handleSubscriptionOnHold(db, payload, dependencies);
		},
		onSubscriptionCancelled: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await handleSubscriptionCancelled(db, payload, dependencies);
		},
		onSubscriptionExpired: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await handleSubscriptionExpired(db, payload, dependencies);
		},
		onSubscriptionFailed: async (
			payload: DodoSubscriptionWebhookPayload | unknown,
		) => {
			await handleSubscriptionFailed(db, payload, dependencies);
		},
	};
}

export type DodoSubscriptionWebhookHandlers = ReturnType<
	typeof createDodoSubscriptionWebhookHandlers
>;
