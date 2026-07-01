import { afterEach, describe, expect, it, vi } from "vitest";
import { getProfileAnalyticsResponse } from "../profile-summary";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("getProfileAnalyticsResponse", () => {
	it("returns today's unique visitors only", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					visitors: { value: 17 },
				}),
				{
					headers: {
						"Content-Type": "application/json",
					},
					status: 200,
				},
			) as never,
		);

		const response = await getProfileAnalyticsResponse({
			env: {
				UMAMI_API_KEY: "api-key",
				UMAMI_WEBSITE_ID: "website-1",
			} as never,
			profilePageId: "page-1",
			timezone: "Asia/Seoul",
		});

		expect(response).toEqual({ visitors: 17 });
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0]).toBeInstanceOf(URL);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
			"https://api.umami.is/v1/websites/website-1/sessions/stats",
		);
	});

	it("returns zero when the user has no owned profile page", async () => {
		const response = await getProfileAnalyticsResponse({
			env: {} as never,
			profilePageId: null,
			timezone: "UTC",
		});

		expect(response).toEqual({ visitors: 0 });
	});
});
