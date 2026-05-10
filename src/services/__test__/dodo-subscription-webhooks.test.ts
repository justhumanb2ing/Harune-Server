import { describe, expect, it } from "vitest";

import { createDodoSubscriptionWebhookHandlers } from "../dodo-subscription-webhooks";

function buildUpdatedUser(
	userId: string,
	email: string,
	patch: {
		dodoCustomerId?: string | null;
		dodoSubscriptionId?: string | null;
		dodoSubscriptionAccessUntilAt?: Date | null;
		planId?: string | null;
	},
) {
	return {
		id: userId,
		email,
		dodoCustomerId: patch.dodoCustomerId ?? null,
		dodoSubscriptionId: patch.dodoSubscriptionId ?? null,
		dodoSubscriptionAccessUntilAt: patch.dodoSubscriptionAccessUntilAt ?? null,
		planId: patch.planId ?? null,
	};
}

describe("createDodoSubscriptionWebhookHandlers", () => {
	it("activates a user by matching the Dodo customer and product ids", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => ({
				id: "user_1",
				email: "user1@example.com",
				dodoCustomerId: null,
				dodoSubscriptionId: null,
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user1@example.com", patch);
			},
		});

		await handlers.onSubscriptionActive({
			data: {
				customer_id: "cus_1",
				product_id: "pdt_1",
				subscription_id: "sub_1",
				status: "active",
				cancel_at_next_billing_date: false,
			},
		});

		expect(calls).toEqual([
			[
				"user_1",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_1",
					dodoSubscriptionId: "sub_1",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("synchronizes subscription.updated events after payment success", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => ({
				id: "user_1",
				email: "user1@example.com",
				dodoCustomerId: "cus_1",
				dodoSubscriptionId: "sub_1",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user1@example.com", patch);
			},
		});

		await handlers.onSubscriptionUpdated({
			data: {
				customer_id: "cus_1",
				product_id: "pdt_1",
				subscription_id: "sub_1",
				status: "active",
				cancel_at_next_billing_date: false,
			},
		});

		expect(calls).toEqual([
			[
				"user_1",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_1",
					dodoSubscriptionId: "sub_1",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("revalidates the subscription id on renewal when the customer lookup is missing", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => ({
				id: "user_2",
				email: "user2@example.com",
				dodoCustomerId: "cus_2",
				dodoSubscriptionId: "sub_old",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_pro",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user2@example.com", patch);
			},
		});

		await handlers.onSubscriptionRenewed({
			data: {
				customer_id: "cus_2",
				subscription_id: "sub_new",
				product_id: "pdt_1",
				status: "active",
				cancel_at_next_billing_date: false,
			},
		});

		expect(calls).toEqual([
			[
				"user_2",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_2",
					dodoSubscriptionId: "sub_new",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("maps plan changes to the new local plan", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => ({
				id: "user_3",
				email: "user3@example.com",
				dodoCustomerId: "cus_3",
				dodoSubscriptionId: "sub_3",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_premium",
				default: false,
				codename: "premium",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user3@example.com", patch);
			},
		});

		await handlers.onSubscriptionPlanChanged({
			data: {
				customer_id: "cus_3",
				product_id: "pdt_premium",
				subscription_id: "sub_3",
				status: "active",
				cancel_at_next_billing_date: false,
			},
		});

		expect(calls).toEqual([
			[
				"user_3",
				expect.objectContaining({
					planId: "plan_premium",
					dodoCustomerId: "cus_3",
					dodoSubscriptionId: "sub_3",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("fails when a webhook product does not match any local plan", async () => {
		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => ({
				id: "user_9",
				email: "user9@example.com",
				dodoCustomerId: "cus_9",
				dodoSubscriptionId: "sub_9",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => null,
		});

		await expect(
			handlers.onSubscriptionActive({
				data: {
					customer_id: "cus_9",
					product_id: "pdt_unknown",
					subscription_id: "sub_9",
					status: "active",
				},
			}),
		).rejects.toMatchObject({
			status: 500,
			message: "matching plan not found for subscription product",
		});
	});

	it("keeps access until the next billing date when a subscription is cancelled", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => ({
				id: "user_4",
				email: "user4@example.com",
				dodoCustomerId: "cus_4",
				dodoSubscriptionId: "sub_4",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user4@example.com", patch);
			},
		});

		await handlers.onSubscriptionCancelled({
			data: {
				customer_id: "cus_4",
				subscription_id: "sub_4",
				status: "cancelled",
				cancel_at_next_billing_date: true,
				next_billing_date: "2026-06-01T00:00:00.000Z",
				cancelled_at: "2026-05-10T00:00:00.000Z",
			},
		});

		expect(calls).toEqual([
			[
				"user_4",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_4",
					dodoSubscriptionId: "sub_4",
					dodoSubscriptionAccessUntilAt: new Date("2026-06-01T00:00:00.000Z"),
				}),
			],
		]);
	});

	it("drops access when a subscription expires", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => ({
				id: "user_4",
				email: "user4@example.com",
				dodoCustomerId: "cus_4",
				dodoSubscriptionId: "sub_4",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_pro",
			}),
			findDefaultPlan: async () => ({
				id: "plan_free",
				default: true,
				codename: "free",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user4@example.com", patch);
			},
		});

		await handlers.onSubscriptionExpired({
			data: {
				customer_id: "cus_4",
				subscription_id: "sub_4",
				status: "expired",
				cancel_at_next_billing_date: false,
				expires_at: "2026-06-01T00:00:00.000Z",
			},
		});

		expect(calls).toEqual([
			[
				"user_4",
				expect.objectContaining({
					planId: "plan_free",
					dodoCustomerId: "cus_4",
					dodoSubscriptionId: "sub_4",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("reverts on-hold events to the default plan", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => ({
				id: "user_5",
				email: "user5@example.com",
				dodoCustomerId: "cus_5",
				dodoSubscriptionId: "sub_5",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_pro",
			}),
			findDefaultPlan: async () => ({
				id: "plan_free",
				default: true,
				codename: "free",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user5@example.com", patch);
			},
		});

		await handlers.onSubscriptionOnHold({
			data: {
				customer_id: "cus_5",
				subscription_id: "sub_5",
				status: "on_hold",
				cancel_at_next_billing_date: false,
			},
		});

		expect(calls).toEqual([
			[
				"user_5",
				expect.objectContaining({
					planId: "plan_free",
					dodoCustomerId: "cus_5",
					dodoSubscriptionId: "sub_5",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("activates a user from payment success using customer email and product cart", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => null,
			findUserByEmail: async () => ({
				id: "user_6",
				email: "user6@example.com",
				dodoCustomerId: null,
				dodoSubscriptionId: null,
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user6@example.com", patch);
			},
		});

		await handlers.onPaymentSucceeded({
			data: {
				customer: {
					email: "user6@example.com",
				},
				product_cart: [
					{
						product_id: "pdt_1",
						quantity: 1,
					},
				],
				subscription_id: "sub_6",
			},
		});

		expect(calls).toEqual([
			[
				"user_6",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: null,
					dodoSubscriptionId: "sub_6",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("backfills the Dodo customer id when payment success only matches by email", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => null,
			findUserByEmail: async () => ({
				id: "user_8",
				email: "user8@example.com",
				dodoCustomerId: null,
				dodoSubscriptionId: null,
				planId: "plan_free",
				dodoSubscriptionAccessUntilAt: null,
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user8@example.com", patch);
			},
		});

		await handlers.onPaymentSucceeded({
			data: {
				customer: {
					customer_id: "cus_8",
					email: "user8@example.com",
				},
				product_cart: [
					{
						product_id: "pdt_1",
						quantity: 1,
					},
				],
				subscription_id: "sub_8",
			},
		});

		expect(calls).toEqual([
			[
				"user_8",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_8",
					dodoSubscriptionId: "sub_8",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("activates a user from checkout metadata reference id when customer email is absent", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => null,
			findUserById: async (_db, userId) =>
				userId === "user_12"
					? {
							id: "user_12",
							email: "user12@example.com",
							dodoCustomerId: null,
							dodoSubscriptionId: null,
							dodoSubscriptionAccessUntilAt: null,
							planId: "plan_free",
						}
					: null,
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user12@example.com", patch);
			},
		});

		await handlers.onPaymentSucceeded({
			data: {
				customer: {
					customer_id: "cus_12",
				},
				metadata: {
					referenceId: "user_12",
				},
				product_cart: [
					{
						product_id: "pdt_1",
						quantity: 1,
					},
				],
				subscription_id: "sub_12",
			},
		});

		expect(calls).toEqual([
			[
				"user_12",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_12",
					dodoSubscriptionId: "sub_12",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("accepts a direct Dodo data object without an event data wrapper", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => null,
			findUserByDodoSubscriptionId: async () => null,
			findUserByEmail: async () => ({
				id: "user_10",
				email: "user10@example.com",
				dodoCustomerId: null,
				dodoSubscriptionId: null,
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user10@example.com", patch);
			},
		});

		await handlers.onPaymentSucceeded({
			customer: {
				customer_id: "cus_10",
				email: "user10@example.com",
			},
			product_cart: [
				{
					product_id: "pdt_1",
					quantity: 1,
				},
			],
			subscription_id: "sub_10",
		});

		expect(calls).toEqual([
			[
				"user_10",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_10",
					dodoSubscriptionId: "sub_10",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});

	it("stores a Date object next billing date from parsed Dodo payloads", async () => {
		const calls: unknown[] = [];
		const nextBillingDate = new Date("2026-06-01T00:00:00.000Z");

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoCustomerId: async () => ({
				id: "user_11",
				email: "user11@example.com",
				dodoCustomerId: "cus_11",
				dodoSubscriptionId: "sub_11",
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async () => ({
				id: "plan_pro",
				default: false,
				codename: "pro",
			}),
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user11@example.com", patch);
			},
		});

		await handlers.onSubscriptionUpdated({
			data: {
				customer_id: "cus_11",
				product_id: "pdt_1",
				subscription_id: "sub_11",
				status: "active",
				next_billing_date: nextBillingDate,
			},
		});

		expect(calls).toEqual([
			[
				"user_11",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: "cus_11",
					dodoSubscriptionId: "sub_11",
					dodoSubscriptionAccessUntilAt: nextBillingDate,
				}),
			],
		]);
	});

	it("uses any matching product in a payment cart when the first item is not the subscription product", async () => {
		const calls: unknown[] = [];

		const handlers = createDodoSubscriptionWebhookHandlers({} as never, {
			findUserByDodoSubscriptionId: async () => null,
			findUserByEmail: async () => ({
				id: "user_7",
				email: "user7@example.com",
				dodoCustomerId: null,
				dodoSubscriptionId: null,
				dodoSubscriptionAccessUntilAt: null,
				planId: "plan_free",
			}),
			findPlanByMonthlyDodoProductId: async (_db, productId) => {
				if (productId === "pdt_subscription") {
					return {
						id: "plan_pro",
						default: false,
						codename: "pro",
					};
				}

				return null;
			},
			updateUserSubscriptionStateById: async (_db, userId, patch) => {
				calls.push([userId, patch]);
				return buildUpdatedUser(userId, "user7@example.com", patch);
			},
		});

		await handlers.onPaymentSucceeded({
			data: {
				customer: {
					email: "user7@example.com",
				},
				product_cart: [
					{
						product_id: "pdt_addon",
						quantity: 1,
					},
					{
						product_id: "pdt_subscription",
						quantity: 1,
					},
				],
				subscription_id: "sub_7",
			},
		});

		expect(calls).toEqual([
			[
				"user_7",
				expect.objectContaining({
					planId: "plan_pro",
					dodoCustomerId: null,
					dodoSubscriptionId: "sub_7",
					dodoSubscriptionAccessUntilAt: null,
				}),
			],
		]);
	});
});
