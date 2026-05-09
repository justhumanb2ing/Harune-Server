import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import type { AppBindings } from "../../types/app-bindings";
import { createBillingRoute } from "../billing-route";

describe("billing route", () => {
	it("returns DodoPayments products with stable slugs", async () => {
		const route = createBillingRoute({
			listProducts: async () => [
				{
					business_id: "biz_1",
					created_at: "2026-05-09T00:00:00.000Z",
					currency: "USD",
					description: "Pro plan",
					image: "https://cdn.example.com/pro.png",
					is_recurring: true,
					metadata: { slug: " Pro Plan " },
					name: "Pro Plan",
					price: 1200,
					product_id: "pdt_123",
					tax_category: "digital_products",
					tax_inclusive: true,
					updated_at: "2026-05-09T00:00:00.000Z",
				},
				{
					business_id: "biz_1",
					created_at: "2026-05-09T00:00:00.000Z",
					currency: null,
					description: null,
					image: null,
					is_recurring: false,
					metadata: {},
					name: null,
					price: null,
					product_id: "pdt_456",
					tax_category: "digital_products",
					tax_inclusive: null,
					updated_at: "2026-05-09T00:00:00.000Z",
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
					slug: "pro-plan",
					productId: "pdt_123",
					businessId: "biz_1",
					name: "Pro Plan",
					description: "Pro plan",
					image: "https://cdn.example.com/pro.png",
					isRecurring: true,
					currency: "USD",
					price: 1200,
					taxCategory: "digital_products",
					taxInclusive: true,
					createdAt: "2026-05-09T00:00:00.000Z",
					updatedAt: "2026-05-09T00:00:00.000Z",
				},
				{
					slug: "pdt_456",
					productId: "pdt_456",
					businessId: "biz_1",
					name: null,
					description: null,
					image: null,
					isRecurring: false,
					currency: null,
					price: null,
					taxCategory: "digital_products",
					taxInclusive: null,
					createdAt: "2026-05-09T00:00:00.000Z",
					updatedAt: "2026-05-09T00:00:00.000Z",
				},
			],
		});
	});

	it("returns a bad gateway response when DodoPayments fails", async () => {
		const route = createBillingRoute({
			listProducts: async () => {
				throw new Error("boom");
			},
		});

		const app = new Hono<AppBindings>();
		app.route("/billing", route);

		const response = await app.request("/billing/products");

		expect(response.status).toBe(502);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(await response.json()).toEqual({
			error: {
				code: "dodo_payments_unavailable",
				message: "failed to load products",
			},
		});
	});
});
