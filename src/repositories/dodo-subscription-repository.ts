import { and, eq, isNotNull, lte } from "drizzle-orm";

import type { Database } from "../lib/db";
import { users } from "../schemas/base";
import { plans } from "../schemas/plan";

export type DodoSubscriptionUserRow = {
	id: string;
	email: string;
	dodoCustomerId: string | null;
	dodoSubscriptionId: string | null;
	dodoSubscriptionAccessUntilAt: Date | null;
	planId: string | null;
};

export type DodoSubscriptionPlanRow = {
	id: string;
	default: boolean | null;
	codename: string | null;
};

export async function findUserByDodoCustomerId(
	db: Database,
	customerId: string,
): Promise<DodoSubscriptionUserRow | null> {
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			dodoCustomerId: users.dodoCustomerId,
			dodoSubscriptionId: users.dodoSubscriptionId,
			dodoSubscriptionAccessUntilAt: users.dodoSubscriptionAccessUntilAt,
			planId: users.planId,
		})
		.from(users)
		.where(eq(users.dodoCustomerId, customerId))
		.limit(1);

	return rows[0] ?? null;
}

export async function findUserByDodoSubscriptionId(
	db: Database,
	subscriptionId: string,
): Promise<DodoSubscriptionUserRow | null> {
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			dodoCustomerId: users.dodoCustomerId,
			dodoSubscriptionId: users.dodoSubscriptionId,
			dodoSubscriptionAccessUntilAt: users.dodoSubscriptionAccessUntilAt,
			planId: users.planId,
		})
		.from(users)
		.where(eq(users.dodoSubscriptionId, subscriptionId))
		.limit(1);

	return rows[0] ?? null;
}

export async function findUserById(
	db: Database,
	userId: string,
): Promise<DodoSubscriptionUserRow | null> {
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			dodoCustomerId: users.dodoCustomerId,
			dodoSubscriptionId: users.dodoSubscriptionId,
			dodoSubscriptionAccessUntilAt: users.dodoSubscriptionAccessUntilAt,
			planId: users.planId,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return rows[0] ?? null;
}

export async function findUserByEmail(
	db: Database,
	email: string,
): Promise<DodoSubscriptionUserRow | null> {
	const rows = await db
		.select({
			id: users.id,
			email: users.email,
			dodoCustomerId: users.dodoCustomerId,
			dodoSubscriptionId: users.dodoSubscriptionId,
			dodoSubscriptionAccessUntilAt: users.dodoSubscriptionAccessUntilAt,
			planId: users.planId,
		})
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	return rows[0] ?? null;
}

export async function findPlanByMonthlyDodoProductId(
	db: Database,
	productId: string,
): Promise<DodoSubscriptionPlanRow | null> {
	const rows = await db
		.select({
			id: plans.id,
			default: plans.default,
			codename: plans.codename,
		})
		.from(plans)
		.where(eq(plans.monthlyDodoProductId, productId))
		.limit(1);

	return rows[0] ?? null;
}

export async function findDefaultPlan(
	db: Database,
): Promise<DodoSubscriptionPlanRow | null> {
	const rows = await db
		.select({
			id: plans.id,
			default: plans.default,
			codename: plans.codename,
		})
		.from(plans)
		.where(eq(plans.default, true))
		.limit(1);

	return rows[0] ?? null;
}

export async function updateUserSubscriptionStateById(
	db: Database,
	userId: string,
	input: {
		planId?: string | null;
		dodoCustomerId?: string | null;
		dodoSubscriptionId?: string | null;
		dodoSubscriptionAccessUntilAt?: Date | null;
	},
) {
	const patch: {
		planId?: string | null;
		dodoCustomerId?: string | null;
		dodoSubscriptionId?: string | null;
		dodoSubscriptionAccessUntilAt?: Date | null;
		updatedAt: Date;
	} = {
		updatedAt: new Date(),
	};

	if (input.planId !== undefined) {
		patch.planId = input.planId;
	}

	if (input.dodoCustomerId !== undefined) {
		patch.dodoCustomerId = input.dodoCustomerId;
	}

	if (input.dodoSubscriptionId !== undefined) {
		patch.dodoSubscriptionId = input.dodoSubscriptionId;
	}

	if (input.dodoSubscriptionAccessUntilAt !== undefined) {
		patch.dodoSubscriptionAccessUntilAt = input.dodoSubscriptionAccessUntilAt;
	}

	const rows = await db
		.update(users)
		.set(patch)
		.where(eq(users.id, userId))
		.returning({
			id: users.id,
			email: users.email,
			dodoCustomerId: users.dodoCustomerId,
			dodoSubscriptionId: users.dodoSubscriptionId,
			dodoSubscriptionAccessUntilAt: users.dodoSubscriptionAccessUntilAt,
			planId: users.planId,
		});

	return rows[0] ?? null;
}

export async function clearExpiredDodoSubscriptionAccess(
	db: Database,
	cutoff: Date,
) {
	const rows = await db
		.update(users)
		.set({
			planId: null,
			dodoSubscriptionAccessUntilAt: null,
			updatedAt: new Date(),
		})
		.where(
			and(
				isNotNull(users.dodoSubscriptionAccessUntilAt),
				lte(users.dodoSubscriptionAccessUntilAt, cutoff),
			),
		)
		.returning({
			id: users.id,
			email: users.email,
			dodoCustomerId: users.dodoCustomerId,
			dodoSubscriptionId: users.dodoSubscriptionId,
			dodoSubscriptionAccessUntilAt: users.dodoSubscriptionAccessUntilAt,
			planId: users.planId,
		});

	return rows;
}
