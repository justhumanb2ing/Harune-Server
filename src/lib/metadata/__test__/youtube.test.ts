import { afterEach, describe, expect, it, vi } from "vitest";

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

	it("tries id, handle, and username lookups until one returns a channel", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(JSON.stringify({ items: [] }), {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			}) as Response,
		);
		fetchSpy.mockResolvedValueOnce(
			new Response(JSON.stringify({ items: [] }), {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			}) as Response,
		);
		fetchSpy.mockResolvedValueOnce(
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
			new URL("https://www.youtube.com/c/GoogleDevelopers"),
			{
				apiKey: "youtube-key",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(3);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
			"forHandle=GoogleDevelopers",
		);
		expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
			"forUsername=GoogleDevelopers",
		);
		expect(String(fetchSpy.mock.calls[2]?.[0])).toContain(
			"id=GoogleDevelopers",
		);
		expect(metadata.providerMetadata?.provider).toBe("youtube");
		expect(metadata.providerMetadata?.viewType).toBe("youtube_channel");
	});

	it("uses the first channels.list item and keeps snippet/statistics only in provider metadata", async () => {
		const now = new Date("2026-05-12T12:00:00.000Z");
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "UCkRfArvrzheW2E7b6SVT7vQ",
							snippet: {
								title: "YouTube Creators",
								description: "Official channel for creators",
								thumbnails: {
									default: {
										url: "https://i.ytimg.com/default.jpg",
									},
									high: {
										url: "https://i.ytimg.com/high.jpg",
									},
								},
							},
							statistics: {
								viewCount: 123456,
								subscriberCount: 7890,
								hiddenSubscriberCount: false,
								videoCount: 42,
							},
						},
						{
							id: "UCignored",
							snippet: {
								title: "Should not be used",
							},
							statistics: {
								viewCount: 1,
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
			new URL("https://www.youtube.com/@youtubecreators/videos"),
			{
				apiKey: "youtube-key",
				now,
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&key=youtube-key&forHandle=youtubecreators",
		);
		expect(metadata).toEqual({
			url: "https://www.youtube.com/@youtubecreators/videos",
			canonicalUrl: "https://www.youtube.com/channel/UCkRfArvrzheW2E7b6SVT7vQ",
			title: "YouTube Creators",
			description: "Official channel for creators",
			image: "https://i.ytimg.com/high.jpg",
			siteName: "YouTube",
			favicon: "https://www.youtube.com/favicon.ico",
			provider: "youtube",
			providerMetadata: {
				provider: "youtube",
				viewType: "youtube_channel",
				fetchedAt: "2026-05-12T12:00:00.000Z",
				payload: {
					snippet: {
						title: "YouTube Creators",
						description: "Official channel for creators",
						thumbnails: {
							default: {
								url: "https://i.ytimg.com/default.jpg",
							},
							high: {
								url: "https://i.ytimg.com/high.jpg",
							},
						},
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
