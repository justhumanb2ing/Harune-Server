import { afterEach, describe, expect, it, vi } from "vitest";

import {
	extractYoutubeChannelCandidate,
	extractYoutubeVideoId,
	fetchYoutubeMetadata,
	fetchYoutubeVideoMetadata,
	isYoutubeChannelUrl,
	isYoutubeVideoUrl,
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
		expect(
			isYoutubeVideoUrl(new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ")),
		).toBe(true);
		expect(extractYoutubeVideoId(new URL("https://youtu.be/dQw4w9WgXcQ"))).toBe(
			"dQw4w9WgXcQ",
		);
		expect(
			extractYoutubeVideoId(
				new URL("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
			),
		).toBe("dQw4w9WgXcQ");
		expect(
			isYoutubeVideoUrl(
				new URL("https://www.youtube.com/@YouTubeCreators/videos"),
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
		fetchSpy.mockResolvedValueOnce(
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

		const metadata = await fetchYoutubeMetadata(
			new URL("https://www.youtube.com/c/GoogleDevelopers"),
			{
				apiKey: "youtube-key",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(4);
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
			)
			.mockResolvedValueOnce(
				new Response(
					`<!doctype html><html><head>
						<link rel="icon" href="https://www.youtube.com/favicon.ico">
						<link rel="icon" href="https://www.youtube.com/s/desktop/14cba078/img/favicon_144x144.png" sizes="144x144">
					</head><body></body></html>`,
					{
						status: 200,
						headers: {
							"content-type": "text/html; charset=utf-8",
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

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cstatistics&key=youtube-key&forHandle=youtubecreators",
		);
		expect(metadata).toEqual({
			url: "https://www.youtube.com/@youtubecreators/videos",
			domain: "youtube.com",
			title: "YouTube Creators",
			description: "Official channel for creators",
			image: "https://i.ytimg.com/high.jpg",
			siteName: "YouTube",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/youtube.svg",
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

	it("uses videos.list and player metadata for video URLs", async () => {
		const now = new Date("2026-05-12T12:00:00.000Z");
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "dQw4w9WgXcQ",
							snippet: {
								title: "Never Gonna Give You Up",
								description: "Music video",
								channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
								channelTitle: "Rick Astley",
								thumbnails: {
									high: {
										url: "https://i.ytimg.com/high.jpg",
									},
								},
							},
							player: {
								embedHtml:
									'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
								embedWidth: 640,
								embedHeight: 360,
							},
							statistics: {
								viewCount: 123456789,
								likeCount: 9876543,
								commentCount: 12345,
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

		const metadata = await fetchYoutubeVideoMetadata(
			new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			{
				apiKey: "youtube-key",
				now,
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://www.googleapis.com/youtube/v3/videos?part=snippet%2Cplayer%2Cstatistics&id=dQw4w9WgXcQ&key=youtube-key",
		);
		expect(metadata).toEqual({
			url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
			domain: "youtube.com",
			title: "Never Gonna Give You Up",
			description: "Music video",
			image: "https://i.ytimg.com/high.jpg",
			siteName: "YouTube",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/youtube.svg",
			provider: "youtube",
			providerMetadata: {
				provider: "youtube",
				viewType: "youtube_video",
				fetchedAt: "2026-05-12T12:00:00.000Z",
				payload: {
					videoId: "dQw4w9WgXcQ",
					channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
					channelTitle: "Rick Astley",
					snippet: {
						title: "Never Gonna Give You Up",
						description: "Music video",
						channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
						channelTitle: "Rick Astley",
						thumbnails: {
							high: {
								url: "https://i.ytimg.com/high.jpg",
							},
						},
					},
					statistics: {
						viewCount: 123456789,
						likeCount: 9876543,
						commentCount: 12345,
					},
					player: {
						embedHtml:
							'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
						embedWidth: 640,
						embedHeight: 360,
					},
				},
			},
		});
	});
});
