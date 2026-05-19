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

	it("uses the Twitch provider path before generic html extraction", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: [
							{
								id: "141981764",
								login: "twitchdev",
								display_name: "TwitchDev",
								profile_image_url: "https://static-cdn.jtvnw.net/profile.png",
								offline_image_url: "https://static-cdn.jtvnw.net/offline.png",
								view_count: 1,
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
				new Response(JSON.stringify({ total: 999 }), {
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				}) as Response,
			);

		const metadata = await fetchMetadata(
			new URL("https://www.twitch.tv/twitchdev"),
			{
				twitchClientId: "twitch-client-id",
				twitchUserAccessToken: "twitch-user-token",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(metadata.provider).toBe("twitch");
		expect(metadata.providerMetadata?.viewType).toBe("twitch_channel");
	});

	it("uses the Discord provider path before generic html extraction", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					code: "abc123",
					guild: {
						id: "123456789012345678",
						name: "Harune Community",
						approximate_member_count: 12345,
						approximate_presence_count: 321,
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
			new URL("https://discord.gg/abc123"),
			{},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(metadata.provider).toBe("discord");
		expect(metadata.providerMetadata?.viewType).toBe("discord_invite");
	});

	it("uses the YouTube video provider path before channel extraction", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "dQw4w9WgXcQ",
							snippet: {
								title: "Never Gonna Give You Up",
								description: "Music video",
								thumbnails: {
									high: {
										url: "https://i.ytimg.com/high.jpg",
									},
								},
							},
							player: {
								embedHtml:
									'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
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
		);

		const metadata = await fetchMetadata(
			new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
			{
				youtubeApiKey: "youtube-key",
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(metadata.provider).toBe("youtube");
		expect(metadata.providerMetadata?.viewType).toBe("youtube_video");
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

	it("uses spotify oEmbed metadata before falling back to generic extraction", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					`<!doctype html><html><head>
						<link rel="alternate" type="application/json+oembed" href="https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F123">
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
						html: '<iframe src="https://open.spotify.com/embed/track/123"></iframe>',
						width: 456,
						height: 152,
						version: "1.0",
						provider_name: "Spotify",
						provider_url: "https://spotify.com",
						type: "rich",
						title: "Spotify track",
						thumbnail_url: "https://i.scdn.co/image/abc",
						thumbnail_width: 300,
						thumbnail_height: 300,
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
			new URL("https://open.spotify.com/track/123"),
			{},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(metadata.provider).toBe("spotify");
		expect(metadata.siteName).toBe("Spotify");
		expect(metadata.providerMetadata?.provider).toBe("spotify");
		expect(metadata.providerMetadata?.viewType).toBe("spotify_oembed");
		expect(metadata.image).toBe("https://i.scdn.co/image/abc");
	});
});
