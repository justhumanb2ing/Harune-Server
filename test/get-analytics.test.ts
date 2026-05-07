import { describe, expect, it } from "bun:test";

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
				getProfileAnalyticsResponse: async (input) => {
					calls.push(input);
					return {
						profilePageId: "page-1",
						state: "ready",
						summaries: {} as never,
						timezone: "Asia/Seoul",
					} as ProfileAnalyticsResponse;
				},
			},
		);

		expect(response).toEqual({
			profilePageId: "page-1",
			state: "ready",
			summaries: {},
			timezone: "Asia/Seoul",
		});
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
				getProfileAnalyticsResponse: async (input) => {
					return {
						profilePageId: null,
						state: "no-profile",
						summaries: {} as never,
						timezone: "UTC",
					} as ProfileAnalyticsResponse;
				},
			},
		);

		expect(response).toEqual({
			profilePageId: null,
			state: "no-profile",
			summaries: {},
			timezone: "UTC",
		});
	});
});
