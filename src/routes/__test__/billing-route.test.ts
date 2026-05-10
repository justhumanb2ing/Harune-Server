import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AppBindings } from "../../types/app-bindings";
import { createBillingRoute } from "../billing-route";

describe("billing route", () => {
	it("returns billing plans from the database with stable slugs", async () => {
		const route = createBillingRoute({
			listPlans: async () => [
				{
					codename: "free",
					default: true,
					id: "plan_free",
					monthlyDodoProductId: null,
					monthlyPrice: null,
					name: "Free",
					quotas: {
						permiumSupport: false,
						monthlyImages: 10,
						somethingElse: "something",
					},
				},
				{
					codename: "pro-plan",
					default: false,
					id: "plan_pro",
					monthlyDodoProductId: "pdt_123",
					monthlyPrice: 399,
					name: "Pro Plan",
					quotas: {
						permiumSupport: true,
						monthlyImages: 100,
						somethingElse: "something",
					},
				},
				{
					codename: null,
					default: false,
					id: "plan_special",
					monthlyDodoProductId: "pdt_789",
					monthlyPrice: 1500,
					name: "Special Plan",
					quotas: null,
				},
			],
		});

		const app = new Hono<AppBindings>();
		app.route("/billing", route);

		const response = await app.request("/billing/products");

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(await response.json()).toEqual({
			items: [
				{
					id: "plan_free",
					slug: "free",
					productId: "plan_free",
					name: "Free",
					price: null,
					default: true,
					quotas: {
						permiumSupport: false,
						monthlyImages: 10,
						somethingElse: "something",
					},
				},
				{
					id: "plan_pro",
					slug: "pro-plan",
					productId: "pdt_123",
					name: "Pro Plan",
					price: 399,
					default: false,
					quotas: {
						permiumSupport: true,
						monthlyImages: 100,
						somethingElse: "something",
					},
				},
				{
					id: "plan_special",
					slug: "plan_special",
					productId: "pdt_789",
					name: "Special Plan",
					price: 1500,
					default: false,
					quotas: null,
				},
			],
		});
	});

	it("returns an internal server error when loading billing plans fails", async () => {
		const route = createBillingRoute({
			listPlans: async () => {
				throw new Error("boom");
			},
		});

		const app = new Hono<AppBindings>();
		app.route("/billing", route);

		const response = await app.request("/billing/products");

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(await response.json()).toEqual({
			error: {
				code: "billing_products_unavailable",
				message: "failed to load billing products",
			},
		});
	});
});
