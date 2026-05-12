import { afterEach, describe, expect, it, vi } from "vitest";

import { extractMetadata } from "../html";
import {
	extractYoutubeChannelCandidate,
	fetchYoutubeMetadata,
	isYoutubeChannelUrl,
} from "../youtube";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("youtube metadata", () => {
	it("detects canonical YouTube channel URLs", () => {
		expect(
			isYoutubeChannelUrl(new URL("https://www.youtube.com/channel/UC123")),
		).toBe(true);
		expect(
			extractYoutubeChannelCandidate(
				new URL("https://www.youtube.com/channel/UC123"),
			),
		).toEqual({ value: "UC123", preferredKind: "id" });
		expect(
			extractYoutubeChannelCandidate(
				new URL("https://www.youtube.com/@YouTubeCreators/videos"),
			),
		).toEqual({ value: "YouTubeCreators", preferredKind: "handle" });
		expect(
			extractYoutubeChannelCandidate(
				new URL("https://www.youtube.com/user/GoogleDevelopers/about"),
			),
		).toEqual({ value: "GoogleDevelopers", preferredKind: "username" });
		expect(
			isYoutubeChannelUrl(
				new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			),
		).toBe(false);
	});

	it("preserves html base metadata and enriches it with youtube provider data", async () => {
		const base = extractMetadata(
			`<!doctype html><html><head>
				<title>YouTube Creators</title>
				<meta name="description" content="Official channel for creators">
				<meta property="og:image" content="https://i.ytimg.com/base.jpg">
				<link rel="icon" href="/favicon.ico">
				<link rel="icon" href="/s/desktop/14cba078/img/favicon_144x144.png" sizes="144x144">
			</head><body></body></html>`,
			"https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ",
		);
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "UCkRfArvrzheW2E7b6SVT7vQ",
							snippet: {
								title: "YouTube Creators",
								description: "Official channel for creators",
							},
							statistics: {
								viewCount: 123456,
								subscriberCount: 7890,
								hiddenSubscriberCount: false,
								videoCount: 42,
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

		const metadata = await fetchYoutubeMetadata(
			new URL("https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ"),
			{
				apiKey: "youtube-key",
				base,
				now: new Date("2026-05-12T12:00:00.000Z"),
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&key=youtube-key&id=UCkRfArvrzheW2E7b6SVT7vQ",
		);
		expect(metadata).toEqual({
			...base,
			canonicalUrl: "https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ",
			provider: "youtube",
			providerMetadata: {
				provider: "youtube",
				viewType: "youtube_channel",
				fetchedAt: "2026-05-12T12:00:00.000Z",
				payload: {
					snippet: {
						title: "YouTube Creators",
						description: "Official channel for creators",
					},
					statistics: {
						viewCount: 123456,
						subscriberCount: 7890,
						hiddenSubscriberCount: false,
						videoCount: 42,
					},
				},
			},
		});
	});
});
