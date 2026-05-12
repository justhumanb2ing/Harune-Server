import { describe, expect, it } from "vitest";

import { getAnalytics } from "../src/services/get-analytics";
import type { ProfileAnalyticsResponse } from "../src/types/analytics";

describe("getAnalytics", () => {
	it("passes the owned profile page and timezone through to the analytics response builder", async () => {
		const calls: Array<{
			env: Record<string, string | undefined>;
			profilePageId: string | null;
			timezone?: string | null;
		}> = [];

		const response = await getAnalytics(
			{} as never,
			"user-1",
			{
				env: {
					UMAMI_WEBSITE_ID: "website-1",
				},
				timezoneHeader: "Asia/Seoul",
			},
			{
				findOwnedProfilePageByUserId: async () => ({ id: "page-1" }),
				getProfileAnalyticsResponse: async (_input) => {
					calls.push(_input);
					return {
						visitors: 42,
					} as ProfileAnalyticsResponse;
				},
			},
		);

		expect(response).toEqual({ visitors: 42 });
		expect(calls).toEqual([
			{
				env: {
					UMAMI_WEBSITE_ID: "website-1",
				},
				profilePageId: "page-1",
				timezone: "Asia/Seoul",
			},
		]);
	});

	it("returns no-profile when the user has no owned profile page", async () => {
		const response = await getAnalytics(
			{} as never,
			"user-1",
			{
				env: {},
			},
			{
				findOwnedProfilePageByUserId: async () => null,
				getProfileAnalyticsResponse: async (_input) => {
					return {
						visitors: 0,
					} as ProfileAnalyticsResponse;
				},
			},
		);

		expect(response).toEqual({ visitors: 0 });
	});
});
