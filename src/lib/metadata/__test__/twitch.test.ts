import { afterEach, describe, expect, it, vi } from "vitest";

import {
	extractTwitchChannelLogin,
	fetchTwitchMetadata,
	isTwitchChannelUrl,
} from "../twitch";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("twitch metadata", () => {
	it("detects Twitch channel URLs and extracts the login", () => {
		expect(isTwitchChannelUrl(new URL("https://www.twitch.tv/twitchdev"))).toBe(
			true,
		);
		expect(
			extractTwitchChannelLogin(
				new URL("https://www.twitch.tv/twitchdev/videos"),
			),
		).toBe("twitchdev");
		expect(
			isTwitchChannelUrl(new URL("https://www.twitch.tv/videos/123")),
		).toBe(false);
	});

	it("fetches channel info and follower totals from Helix", async () => {
		const now = new Date("2026-05-19T12:00:00.000Z");
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
								description: "Supporting third-party developers.",
								profile_image_url:
									"https://static-cdn.jtvnw.net/profile_image.png",
								offline_image_url:
									"https://static-cdn.jtvnw.net/offline_image.png",
								view_count: 5980557,
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
				new Response(JSON.stringify({ total: 123456 }), {
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				}) as Response,
			);

		const metadata = await fetchTwitchMetadata(
			new URL("https://www.twitch.tv/twitchdev"),
			{
				clientId: "twitch-client-id",
				accessToken: "twitch-user-access-token",
				now,
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://api.twitch.tv/helix/users?login=twitchdev",
		);
		expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
			"https://api.twitch.tv/helix/channels/followers?broadcaster_id=141981764",
		);
		expect(metadata).toEqual({
			url: "https://www.twitch.tv/twitchdev",
			domain: "twitch.tv",
			title: "TwitchDev",
			description: "Followers 123,456",
			image: "https://static-cdn.jtvnw.net/profile_image.png",
			siteName: "Twitch",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/twitch.svg",
			provider: "twitch",
			providerMetadata: {
				provider: "twitch",
				viewType: "twitch_channel",
				fetchedAt: "2026-05-19T12:00:00.000Z",
				payload: {
					broadcasterId: "141981764",
					broadcasterLogin: "twitchdev",
					broadcasterName: "TwitchDev",
					displayName: "TwitchDev",
					description: "Supporting third-party developers.",
					profileImageUrl: "https://static-cdn.jtvnw.net/profile_image.png",
					offlineImageUrl: "https://static-cdn.jtvnw.net/offline_image.png",
					followerCount: 123456,
					viewCount: 5980557,
				},
			},
		});
	});
});
