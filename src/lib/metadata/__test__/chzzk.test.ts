import { afterEach, describe, expect, it, vi } from "vitest";

import {
	extractChzzkChannelId,
	fetchChzzkMetadata,
	isChzzkChannelUrl,
} from "../chzzk";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("chzzk metadata", () => {
	it("detects CHZZK channel URLs", () => {
		expect(
			isChzzkChannelUrl(
				new URL("https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f"),
			),
		).toBe(true);
		expect(
			extractChzzkChannelId(
				new URL(
					"https://chzzk.naver.com/live/45e71a76e949e16a34764deb962f9d9f",
				),
			),
		).toBe("45e71a76e949e16a34764deb962f9d9f");
		expect(
			extractChzzkChannelId(
				new URL("https://m.chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f"),
			),
		).toBe("45e71a76e949e16a34764deb962f9d9f");
		expect(
			isChzzkChannelUrl(new URL("https://chzzk.naver.com/video/123456")),
		).toBe(false);
		expect(isChzzkChannelUrl(new URL("https://example.com/45e71a76"))).toBe(
			false,
		);
	});

	it("fetches channel metadata from the CHZZK Open API", async () => {
		const now = new Date("2026-05-19T12:00:00.000Z");
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					code: 200,
					message: null,
					content: {
						data: [
							{
								channelId: "45e71a76e949e16a34764deb962f9d9f",
								channelName: "아야츠노 유니",
								channelImageUrl: "https://nng-phinf.pstatic.net/profile.jpg",
								followerCount: 123456,
								verifiedMark: true,
							},
						],
					},
				}),
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				},
			) as Response,
		);

		const metadata = await fetchChzzkMetadata(
			new URL("https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f"),
			{
				clientId: "chzzk-client-id",
				clientSecret: "chzzk-client-secret",
				now,
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://openapi.chzzk.naver.com/open/v1/channels?channelIds=45e71a76e949e16a34764deb962f9d9f",
		);
		expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
			headers: {
				"Client-Id": "chzzk-client-id",
				"Client-Secret": "chzzk-client-secret",
			},
		});
		expect(metadata).toEqual({
			url: "https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f",
			domain: "chzzk.naver.com",
			title: "아야츠노 유니",
			description: "Followers 123,456",
			image: "https://nng-phinf.pstatic.net/profile.jpg",
			siteName: "CHZZK",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/chzzk.svg",
			provider: "chzzk",
			providerMetadata: {
				provider: "chzzk",
				viewType: "chzzk_channel",
				fetchedAt: "2026-05-19T12:00:00.000Z",
				payload: {
					channelId: "45e71a76e949e16a34764deb962f9d9f",
					channelName: "아야츠노 유니",
					channelImageUrl: "https://nng-phinf.pstatic.net/profile.jpg",
					followerCount: 123456,
					verifiedMark: true,
				},
			},
		});
	});
});
