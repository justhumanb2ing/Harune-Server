import type { Database } from "../lib/db";
import {
	clearExpiredDodoSubscriptionAccess,
	type DodoSubscriptionUserRow,
} from "../repositories/dodo-subscription-repository";

type ReconcileExpiredDodoSubscriptionsDependencies = {
	clearExpiredDodoSubscriptionAccess?: (
		db: Database,
		cutoff: Date,
	) => Promise<DodoSubscriptionUserRow[]>;
	now?: () => Date;
};

export async function reconcileExpiredDodoSubscriptions(
	db: Database,
	dependencies: ReconcileExpiredDodoSubscriptionsDependencies = {},
) {
	const now = dependencies.now?.() ?? new Date();
	const clearExpiredAccess =
		dependencies.clearExpiredDodoSubscriptionAccess ??
		clearExpiredDodoSubscriptionAccess;
	const updatedUsers = await clearExpiredAccess(db, now);

	console.log(
		JSON.stringify({
			scope: "dodo_subscription_cron",
			stage: "expired_access_reconciled",
			cutoff: now.toISOString(),
			updatedCount: updatedUsers.length,
			updatedUserIds: updatedUsers.map((user) => user.id),
		}),
	);

	return updatedUsers;
}
