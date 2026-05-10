import { asc, desc } from "drizzle-orm";

import type { Database } from "../lib/db";
import type { Quotas } from "../schemas/plan";
import { plans } from "../schemas/plan";

export type BillingPlanRow = {
	id: string;
	name: string | null;
	codename: string | null;
	default: boolean | null;
	monthlyPrice: number | null;
	monthlyDodoProductId: string | null;
	quotas: Quotas | null;
};

export async function findBillingPlans(
	db: Database,
): Promise<BillingPlanRow[]> {
	return db
		.select({
			id: plans.id,
			name: plans.name,
			codename: plans.codename,
			default: plans.default,
			monthlyPrice: plans.monthlyPrice,
			monthlyDodoProductId: plans.monthlyDodoProductId,
			quotas: plans.quotas,
		})
		.from(plans)
		.orderBy(desc(plans.default), asc(plans.monthlyPrice), asc(plans.name));
}
