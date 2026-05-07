import { desc, eq } from "drizzle-orm";

import type { Database } from "../lib/db";
import { users } from "../schemas/base";
import { plans } from "../schemas/plan";
import { profilePages } from "../schemas/profile";

export type MeRow = NonNullable<Awaited<ReturnType<typeof findMeRowByUserId>>>;

export async function findMeRowByUserId(db: Database, userId: string) {
	const rows = await db
		.select({
			userId: users.id,
			userEmail: users.email,
			userName: users.name,
			userImage: users.image,
			userCreatedAt: users.createdAt,
			userUpdatedAt: users.updatedAt,
			userPlanId: users.planId,
			userCredits: users.credits,
			planId: plans.id,
			planName: plans.name,
			planCodename: plans.codename,
			planQuotas: plans.quotas,
			planDefault: plans.default,
			profilePageId: profilePages.id,
			profilePageHandle: profilePages.handle,
			profilePageName: profilePages.name,
			profilePageImage: profilePages.image,
			profilePageUpdatedAt: profilePages.updatedAt,
		})
		.from(users)
		.leftJoin(plans, eq(plans.id, users.planId))
		.leftJoin(profilePages, eq(profilePages.userId, users.id))
		.where(eq(users.id, userId))
		.orderBy(desc(profilePages.updatedAt), desc(profilePages.createdAt))
		.limit(1);

	return rows[0] ?? null;
}
