import { describe, expect, it } from "vitest";

import {
	findDefaultPlan,
	findPlanByMonthlyDodoProductId,
	findUserByDodoCustomerId,
	findUserByDodoSubscriptionId,
	findUserByEmail,
	findUserById,
	updateUserSubscriptionStateById,
} from "../dodo-subscription-repository";

type SelectQuery<Row> = {
	from: () => SelectQuery<Row>;
	where: () => SelectQuery<Row>;
	limit: () => Promise<Row[]>;
};

type UpdateQuery<Row> = {
	set: (patch: Record<string, unknown>) => UpdateQuery<Row>;
	where: () => UpdateQuery<Row>;
	returning: () => Promise<Row[]>;
};

describe("dodo subscription repository", () => {
	it("finds a user by Dodo customer id", async () => {
		const calls: string[] = [];
		let query: SelectQuery<{
			id: string;
			email: string;
			dodoCustomerId: string;
			dodoSubscriptionId: string;
			dodoSubscriptionAccessUntilAt: Date | null;
			planId: string;
		}>;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			limit: async () => {
				calls.push("limit");
				return [
					{
						id: "user_1",
						email: "user1@example.com",
						dodoCustomerId: "cus_1",
						dodoSubscriptionId: "sub_1",
						dodoSubscriptionAccessUntilAt: null,
						planId: "plan_pro",
					},
				];
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(
			findUserByDodoCustomerId(db as never, "cus_1"),
		).resolves.toEqual({
			id: "user_1",
			email: "user1@example.com",
			dodoCustomerId: "cus_1",
			dodoSubscriptionId: "sub_1",
			dodoSubscriptionAccessUntilAt: null,
			planId: "plan_pro",
		});
		expect(calls).toEqual(["select", "from", "where", "limit"]);
	});

	it("finds a user by Dodo subscription id", async () => {
		const calls: string[] = [];
		let query: SelectQuery<{
			id: string;
			email: string;
			dodoCustomerId: string;
			dodoSubscriptionId: string;
			dodoSubscriptionAccessUntilAt: Date | null;
			planId: string;
		}>;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			limit: async () => {
				calls.push("limit");
				return [
					{
						id: "user_2",
						email: "user2@example.com",
						dodoCustomerId: "cus_2",
						dodoSubscriptionId: "sub_2",
						dodoSubscriptionAccessUntilAt: null,
						planId: "plan_free",
					},
				];
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(
			findUserByDodoSubscriptionId(db as never, "sub_2"),
		).resolves.toEqual({
			id: "user_2",
			email: "user2@example.com",
			dodoCustomerId: "cus_2",
			dodoSubscriptionId: "sub_2",
			dodoSubscriptionAccessUntilAt: null,
			planId: "plan_free",
		});
		expect(calls).toEqual(["select", "from", "where", "limit"]);
	});

	it("finds a user by id", async () => {
		const calls: string[] = [];
		let query: SelectQuery<{
			id: string;
			email: string;
			dodoCustomerId: string;
			dodoSubscriptionId: string;
			dodoSubscriptionAccessUntilAt: Date | null;
			planId: string;
		}>;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			limit: async () => {
				calls.push("limit");
				return [
					{
						id: "user_3",
						email: "user3@example.com",
						dodoCustomerId: null as never,
						dodoSubscriptionId: null as never,
						dodoSubscriptionAccessUntilAt: null,
						planId: null as never,
					},
				];
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(findUserById(db as never, "user_3")).resolves.toEqual({
			id: "user_3",
			email: "user3@example.com",
			dodoCustomerId: null,
			dodoSubscriptionId: null,
			dodoSubscriptionAccessUntilAt: null,
			planId: null,
		});
		expect(calls).toEqual(["select", "from", "where", "limit"]);
	});

	it("finds a user by email", async () => {
		const calls: string[] = [];
		let query: SelectQuery<{
			id: string;
			email: string;
			dodoCustomerId: string;
			dodoSubscriptionId: string;
			dodoSubscriptionAccessUntilAt: Date | null;
			planId: string;
		}>;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			limit: async () => {
				calls.push("limit");
				return [
					{
						id: "user_4",
						email: "user4@example.com",
						dodoCustomerId: null as never,
						dodoSubscriptionId: null as never,
						dodoSubscriptionAccessUntilAt: null,
						planId: "plan_free",
					},
				];
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(
			findUserByEmail(db as never, "user4@example.com"),
		).resolves.toEqual({
			id: "user_4",
			email: "user4@example.com",
			dodoCustomerId: null,
			dodoSubscriptionId: null,
			dodoSubscriptionAccessUntilAt: null,
			planId: "plan_free",
		});
		expect(calls).toEqual(["select", "from", "where", "limit"]);
	});

	it("finds the plan for a Dodo product id", async () => {
		const calls: string[] = [];
		let query: SelectQuery<{
			id: string;
			default: boolean;
			codename: string;
		}>;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			limit: async () => {
				calls.push("limit");
				return [
					{
						id: "plan_pro",
						default: false,
						codename: "pro",
					},
				];
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(
			findPlanByMonthlyDodoProductId(db as never, "pdt_123"),
		).resolves.toEqual({
			id: "plan_pro",
			default: false,
			codename: "pro",
		});
		expect(calls).toEqual(["select", "from", "where", "limit"]);
	});

	it("finds the default plan", async () => {
		const calls: string[] = [];
		let query: SelectQuery<{
			id: string;
			default: boolean;
			codename: string;
		}>;

		query = {
			from: () => {
				calls.push("from");
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			limit: async () => {
				calls.push("limit");
				return [
					{
						id: "plan_free",
						default: true,
						codename: "free",
					},
				];
			},
		};

		const db = {
			select: () => {
				calls.push("select");
				return query;
			},
		};

		await expect(findDefaultPlan(db as never)).resolves.toEqual({
			id: "plan_free",
			default: true,
			codename: "free",
		});
		expect(calls).toEqual(["select", "from", "where", "limit"]);
	});

	it("updates a user's subscription state", async () => {
		const calls: unknown[] = [];
		let query: UpdateQuery<{
			id: string;
			email: string;
			dodoCustomerId: string;
			dodoSubscriptionId: string;
			dodoSubscriptionAccessUntilAt: Date | null;
			planId: string;
		}>;

		query = {
			set: (patch: unknown) => {
				calls.push(["set", patch]);
				return query;
			},
			where: () => {
				calls.push("where");
				return query;
			},
			returning: async () => {
				calls.push("returning");
				return [
					{
						id: "user_1",
						email: "user1@example.com",
						dodoCustomerId: "cus_1",
						dodoSubscriptionId: "sub_1",
						dodoSubscriptionAccessUntilAt: null,
						planId: "plan_pro",
					},
				];
			},
		};

		const db = {
			update: () => {
				calls.push("update");
				return query;
			},
		};

		await expect(
			updateUserSubscriptionStateById(db as never, "user_1", {
				planId: "plan_pro",
				dodoCustomerId: "cus_1",
				dodoSubscriptionId: "sub_1",
			}),
		).resolves.toEqual({
			id: "user_1",
			email: "user1@example.com",
			dodoCustomerId: "cus_1",
			dodoSubscriptionId: "sub_1",
			dodoSubscriptionAccessUntilAt: null,
			planId: "plan_pro",
		});

		expect(calls[0]).toBe("update");
		expect(calls[1]).toEqual([
			"set",
			expect.objectContaining({
				planId: "plan_pro",
				dodoCustomerId: "cus_1",
				dodoSubscriptionId: "sub_1",
				updatedAt: expect.any(Date),
			}),
		]);
		expect(calls[2]).toBe("where");
		expect(calls[3]).toBe("returning");
	});
});
