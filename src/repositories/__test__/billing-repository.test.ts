import { describe, expect, it } from "vitest";

import { findBillingPlans } from "../billing-repository";

describe("findBillingPlans", () => {
	it("lists free and paid billing plans without filtering by monthly pricing", async () => {
		const calls: string[] = [];
		const rows = [
			{
				id: "plan_free",
				name: "Free",
				codename: "free",
				default: true,
				monthlyPrice: null,
				monthlyDodoProductId: null,
				quotas: {
					permiumSupport: false,
					monthlyImages: 10,
					somethingElse: "something",
				},
			},
		];

		let query: any;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			orderBy: async () => {
				calls.push("orderBy");
				return rows;
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(findBillingPlans(db as never)).resolves.toEqual(rows);
		expect(calls).toEqual(["select", "from", "orderBy"]);
	});
});
