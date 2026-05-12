import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMetadata } from "../fetch";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("metadata fetch orchestration", () => {
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
			"https://www.youtube.com/s/desktop/14cba078/img/favicon_144x144.png",
		);
	});
});
