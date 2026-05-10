import { Hono } from "hono";

import { internalServerError } from "../lib/api-response";
import type { Database } from "../lib/db";
import {
	type BillingPlanRow,
	findBillingPlans,
} from "../repositories/billing-repository";
import type { Quotas } from "../schemas/plan";
import type { AppBindings } from "../types/app-bindings";

export type BillingProduct = {
	id: string;
	slug: string;
	productId: string;
	name: string | null;
	price: number | null;
	default: boolean;
	quotas: Quotas | null;
};

type BillingRouteResponse = {
	items: BillingProduct[];
};

type BillingRouteDependencies = {
	listPlans?: (db: Database) => Promise<BillingPlanRow[]>;
};

function withNoStore(response: Response) {
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("Pragma", "no-cache");
	return response;
}

function toBillingProduct(product: BillingPlanRow): BillingProduct {
	return {
		id: product.id,
		slug: product.codename ?? product.id,
		productId: product.monthlyDodoProductId ?? product.id,
		name: product.name ?? null,
		price: product.monthlyPrice ?? null,
		default: product.default ?? false,
		quotas: product.quotas ?? null,
	};
}

export function createBillingRoute(
	dependencies: BillingRouteDependencies = {},
) {
	const listPlans = dependencies.listPlans ?? findBillingPlans;

	return new Hono<AppBindings>().get("/products", async (c) => {
		try {
			const db = c.get("db");
			const items = await listPlans(db);
			const response = c.json<BillingRouteResponse>({
				items: items.map(toBillingProduct),
			});

			return withNoStore(response);
		} catch {
			const response = internalServerError(
				c,
				"billing_products_unavailable",
				"failed to load billing products",
			);
			return withNoStore(response);
		}
	});
}

const billingRoute = createBillingRoute();

export default billingRoute;
export type AppType = typeof billingRoute;
