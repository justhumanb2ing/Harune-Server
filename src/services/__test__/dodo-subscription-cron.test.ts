import { describe, expect, it, vi } from "vitest";

import { reconcileExpiredDodoSubscriptions } from "../dodo-subscription-cron";

describe("reconcileExpiredDodoSubscriptions", () => {
	it("reconciles expired subscriptions using the current time cutoff", async () => {
		const clearExpiredDodoSubscriptionAccess = vi.fn(async () => [
			{ id: "user-1" },
			{ id: "user-2" },
		]);

		const db = {} as never;
		const now = new Date("2026-06-01T00:00:00.000Z");

		await expect(
			reconcileExpiredDodoSubscriptions(db, {
				clearExpiredDodoSubscriptionAccess,
				now: () => now,
			}),
		).resolves.toEqual([{ id: "user-1" }, { id: "user-2" }]);

		expect(clearExpiredDodoSubscriptionAccess).toHaveBeenCalledWith(db, now);
	});
});
