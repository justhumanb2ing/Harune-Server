import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMetadata } from "../fetch";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("metadata fetch orchestration", () => {
	it("always builds base metadata from html before provider enrichment", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					`<!doctype html><html><head>
						<title>YouTube Creators</title>
						<meta property="og:site_name" content="YouTube">
						<meta name="description" content="Official channel for creators">
						<meta property="og:image" content="https://i.ytimg.com/base.jpg">
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
			)
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
								statistics: {
									viewCount: 123456,
								},
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
			);

		const metadata = await fetchMetadata(
			new URL("https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ"),
			{
				youtubeApiKey: "youtube-key",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ",
		);
		expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
			"www.googleapis.com/youtube/v3/channels",
		);
		expect(metadata).toMatchObject({
			url: "https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ",
			canonicalUrl: "https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ",
			title: "YouTube Creators",
			description: "Official channel for creators",
			image: "https://i.ytimg.com/high.jpg",
			siteName: "YouTube",
			favicon:
				"https://www.youtube.com/s/desktop/14cba078/img/favicon_144x144.png",
			provider: "youtube",
		});
		expect(metadata.providerMetadata?.provider).toBe("youtube");
		expect(metadata.providerMetadata?.viewType).toBe("youtube_channel");
	});
});
