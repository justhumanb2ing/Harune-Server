import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSpotifyMetadata, isSpotifyUrl } from "../spotify";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("spotify metadata", () => {
	it("detects spotify oEmbed-capable hosts", () => {
		expect(isSpotifyUrl(new URL("https://open.spotify.com/track/123"))).toBe(
			true,
		);
		expect(isSpotifyUrl(new URL("https://spotify.link/abc"))).toBe(true);
		expect(isSpotifyUrl(new URL("https://example.com"))).toBe(false);
	});

	it("uses spotify oEmbed data when the page exposes an oEmbed link", async () => {
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
						title: "My Path to Spotify: Women in Engineering",
						thumbnail_url:
							"https://i.scdn.co/image/ab67656300005f1ff8141e891abf749375772343",
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

		const metadata = await fetchSpotifyMetadata(
			new URL("https://open.spotify.com/track/123"),
			{
				now: new Date("2026-05-19T00:00:00.000Z"),
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(metadata).toEqual({
			url: "https://open.spotify.com/track/123",
			domain: "open.spotify.com",
			title: "My Path to Spotify: Women in Engineering",
			description: null,
			image: "https://i.scdn.co/image/ab67656300005f1ff8141e891abf749375772343",
			siteName: "Spotify",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/spotify.svg",
			provider: "spotify",
			providerMetadata: {
				provider: "spotify",
				viewType: "spotify_oembed",
				fetchedAt: "2026-05-19T00:00:00.000Z",
				payload: {
					title: "My Path to Spotify: Women in Engineering",
					html: '<iframe src="https://open.spotify.com/embed/track/123"></iframe>',
					width: 456,
					height: 152,
					version: "1.0",
					providerName: "Spotify",
					providerUrl: "https://spotify.com",
					type: "rich",
					thumbnailUrl:
						"https://i.scdn.co/image/ab67656300005f1ff8141e891abf749375772343",
					thumbnailWidth: 300,
					thumbnailHeight: 300,
				},
			},
		});
	});

	it("falls back to generic metadata when a spotify page does not expose oEmbed", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				`<!doctype html><html><head>
					<meta property="og:title" content="Spotify fallback title">
					<link rel="icon" href="/favicon.ico">
				</head><body></body></html>`,
				{
					status: 200,
					headers: {
						"content-type": "text/html; charset=utf-8",
					},
				},
			) as Response,
		);

		const metadata = await fetchSpotifyMetadata(
			new URL("https://open.spotify.com/album/123"),
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(metadata).toEqual({
			url: "https://open.spotify.com/album/123",
			domain: "open.spotify.com",
			title: "Spotify fallback title",
			description: null,
			image: null,
			siteName: "open.spotify.com",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/spotify.svg",
			provider: null,
			providerMetadata: null,
		});
	});
});
