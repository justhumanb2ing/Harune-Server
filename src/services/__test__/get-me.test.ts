import { describe, expect, it, vi } from "vitest";

import type { MeRow } from "../../repositories/me-repository";
import { getMe } from "../get-me";

function buildMeRow(overrides: Partial<MeRow> = {}): MeRow {
	return {
		userId: "user-1",
		userEmail: "user@example.com",
		userName: "User",
		userImage: null,
		userCreatedAt: new Date("2026-05-07T00:00:00.000Z"),
		userUpdatedAt: new Date("2026-05-07T00:00:00.000Z"),
		userPlanId: "plan_pro",
		userCredits: { upload: 12 },
		planId: "plan_pro",
		planName: "Pro",
		planCodename: "pro",
		planQuotas: { seats: 3 },
		planDefault: false,
		profilePageId: "page-1",
		profilePageHandle: "maker",
		profilePageName: "Maker",
		profilePageImage: "https://example.com/avatar.png",
		profilePageImageCrop: null,
		profilePageUpdatedAt: new Date("2026-05-07T00:00:00.000Z"),
		...overrides,
	};
}

describe("getMe", () => {
	it("returns the current me response when the access window is still valid", async () => {
		const updateUserSubscriptionStateById = vi.fn();

		const response = await getMe({} as never, "user-1", {
			findMeRowByUserId: async () =>
				buildMeRow({
					dodoSubscriptionAccessUntilAt: new Date("2026-06-01T00:00:00.000Z"),
				}),
			updateUserSubscriptionStateById,
			now: () => new Date("2026-05-10T00:00:00.000Z"),
		});

		expect(updateUserSubscriptionStateById).not.toHaveBeenCalled();
		expect(response).toEqual({
			currentPlan: {
				id: "plan_pro",
				name: "Pro",
				codename: "pro",
				quotas: { seats: 3 },
				default: false,
			},
			profilePage: {
				id: "page-1",
				handle: "maker",
				name: "Maker",
				image: "https://example.com/avatar.png",
				imageCrop: null,
			},
			user: {
				id: "user-1",
				email: "user@example.com",
				name: "User",
				image: null,
				createdAt: "2026-05-07T00:00:00.000Z",
				updatedAt: "2026-05-07T00:00:00.000Z",
				planId: "plan_pro",
				credits: { upload: 12 },
			},
		});
	});

	it("clears the plan at read time when the access window has expired", async () => {
		const updateUserSubscriptionStateById = vi.fn(async () => ({
			id: "user-1",
			email: "user@example.com",
			dodoCustomerId: "cus-1",
			dodoSubscriptionId: "sub-1",
			dodoSubscriptionAccessUntilAt: null,
			planId: null,
		}));

		const response = await getMe({} as never, "user-1", {
			findMeRowByUserId: async () =>
				buildMeRow({
					dodoSubscriptionAccessUntilAt: new Date("2026-05-09T00:00:00.000Z"),
				}),
			updateUserSubscriptionStateById,
			now: () => new Date("2026-05-10T00:00:00.000Z"),
		});

		expect(updateUserSubscriptionStateById).toHaveBeenCalledWith({}, "user-1", {
			planId: null,
			dodoSubscriptionAccessUntilAt: null,
		});
		expect(response).toEqual({
			currentPlan: null,
			profilePage: {
				id: "page-1",
				handle: "maker",
				name: "Maker",
				image: "https://example.com/avatar.png",
				imageCrop: null,
			},
			user: {
				id: "user-1",
				email: "user@example.com",
				name: "User",
				image: null,
				createdAt: "2026-05-07T00:00:00.000Z",
				updatedAt: "2026-05-07T00:00:00.000Z",
				planId: null,
				credits: { upload: 12 },
			},
		});
	});
});
