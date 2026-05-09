import type { Context } from "hono";
import { Hono } from "hono";

import { badGateway } from "../lib/api-response";
import { createDodoPaymentsClient } from "../lib/dodo-payments";
import type { AppBindings } from "../types/app-bindings";

type DodoProductListItem = {
	business_id: string;
	created_at: string;
	currency?: string | null;
	description?: string | null;
	image?: string | null;
	is_recurring: boolean;
	metadata: Record<string, string>;
	name?: string | null;
	price?: number | null;
	product_id: string;
	tax_category: string;
	tax_inclusive?: boolean | null;
	updated_at: string;
};

export type BillingProduct = {
	slug: string;
	productId: string;
	businessId: string;
	name: string | null;
	description: string | null;
	image: string | null;
	isRecurring: boolean;
	currency: string | null;
	price: number | null;
	taxCategory: string;
	taxInclusive: boolean | null;
	createdAt: string;
	updatedAt: string;
};

type BillingRouteResponse = {
	items: BillingProduct[];
};

type BillingRouteDependencies = {
	listProducts?: (c: Context<AppBindings>) => Promise<DodoProductListItem[]>;
};

function withNoStore(response: Response) {
	response.headers.set("Cache-Control", "no-store");
	response.headers.set("Pragma", "no-cache");
	return response;
}

function normalizeSlug(value: string) {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	return normalized.length > 0 ? normalized : null;
}

function resolveProductSlug(product: DodoProductListItem) {
	const metadataSlug = normalizeSlug(product.metadata.slug ?? "");

	return metadataSlug ?? product.product_id;
}

async function listDodoPaymentsProducts(
	c: Context<AppBindings>,
): Promise<DodoProductListItem[]> {
	const client = createDodoPaymentsClient(c);
	const items: DodoProductListItem[] = [];

	for await (const product of client.products.list({
		archived: false,
		page_size: 100,
	})) {
		items.push(product as DodoProductListItem);
	}

	return items;
}

function toBillingProduct(product: DodoProductListItem): BillingProduct {
	return {
		slug: resolveProductSlug(product),
		productId: product.product_id,
		businessId: product.business_id,
		name: product.name ?? null,
		description: product.description ?? null,
		image: product.image ?? null,
		isRecurring: product.is_recurring,
		currency: product.currency ?? null,
		price: product.price ?? null,
		taxCategory: product.tax_category,
		taxInclusive: product.tax_inclusive ?? null,
		createdAt: product.created_at,
		updatedAt: product.updated_at,
	};
}

export function createBillingRoute(
	dependencies: BillingRouteDependencies = {},
) {
	const listProducts = dependencies.listProducts ?? listDodoPaymentsProducts;

	return new Hono<AppBindings>().get("/products", async (c) => {
		try {
			const items = await listProducts(c);
			const response = c.json<BillingRouteResponse>({
				items: items.map(toBillingProduct),
			});

			return withNoStore(response);
		} catch {
			const response = badGateway(
				c,
				"dodo_payments_unavailable",
				"failed to load products",
			);
			return withNoStore(response);
		}
	});
}

const billingRoute = createBillingRoute();

export default billingRoute;
export type AppType = typeof billingRoute;
