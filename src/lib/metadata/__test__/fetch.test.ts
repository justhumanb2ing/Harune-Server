import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMetadata } from "../fetch";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("metadata fetch orchestration", () => {
	it("uses the CHZZK provider path before generic html extraction", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
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

		const metadata = await fetchMetadata(
			new URL("https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f"),
			{
				chzzkClientId: "chzzk-client-id",
				chzzkClientSecret: "chzzk-client-secret",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(metadata.provider).toBe("chzzk");
		expect(metadata.providerMetadata?.viewType).toBe("chzzk_channel");
	});

	it("reuses the shared head html when resolving youtube metadata", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								id: "UCkRfArvrzheW2E7b6SVT7vQ",
								snippet: {
									title: "YouTube Creators",
									description: "Official channel for creators",
									thumbnails: {
										high: {
											url: "https://i.ytimg.com/high.jpg",
										},
									},
								},
								statistics: {},
							},
						],
					}),
					{
						status: 200,
						headers: {
							"content-type": "application/json",
						},
					},
				) as Response,
			)
			.mockResolvedValueOnce(
				new Response(
					`<!doctype html><html><head>
						<link rel="icon" href="/favicon.ico">
						<link rel="icon" href="/s/desktop/14cba078/img/favicon_144x144.png" sizes="144x144">
					</head><body></body></html>`,
					{
						status: 200,
						headers: {
							"content-type": "text/html; charset=utf-8",
						},
					},
				) as Response,
			);

		const metadata = await fetchMetadata(
			new URL("https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ"),
			{
				youtubeApiKey: "youtube-key",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(metadata.favicon).toBe(
			"https://cdn.harune.me/public/assets/link-provider-icon/youtube.svg",
		);
	});

	it("returns canonical provider icons for supported generic metadata URLs", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				`<!doctype html><html><head>
					<link rel="icon" href="/favicon.ico">
					<meta property="og:title" content="Example post">
				</head><body></body></html>`,
				{
					status: 200,
					headers: {
						"content-type": "text/html; charset=utf-8",
					},
				},
			) as Response,
		);

		const metadata = await fetchMetadata(
			new URL("https://instagram.com/p/example"),
			{},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(metadata.favicon).toBe(
			"https://cdn.harune.me/public/assets/link-provider-icon/instagram.svg",
		);
		expect(metadata.provider).toBeNull();
	});
});
