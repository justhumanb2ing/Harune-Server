import { afterEach, describe, expect, it, vi } from "vitest";

import {
	extractDiscordInviteCode,
	fetchDiscordMetadata,
	isDiscordInviteUrl,
} from "../discord";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("discord metadata", () => {
	it("detects Discord invite URLs and extracts the invite code", () => {
		expect(isDiscordInviteUrl(new URL("https://discord.gg/abc123"))).toBe(true);
		expect(extractDiscordInviteCode(new URL("https://discord.gg/abc123"))).toBe(
			"abc123",
		);
		expect(
			extractDiscordInviteCode(new URL("https://discord.com/invite/abc123")),
		).toBe("abc123");
		expect(
			isDiscordInviteUrl(new URL("https://discord.com/channels/1/2")),
		).toBe(false);
	});

	it("fetches guild invite counts from the Discord invite API", async () => {
		const now = new Date("2026-05-19T12:00:00.000Z");
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					code: "abc123",
					guild: {
						id: "123456789012345678",
						name: "Harune Community",
						description: "A friendly place",
						icon: "guild_icon",
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

		const metadata = await fetchDiscordMetadata(
			new URL("https://discord.com/invite/abc123"),
			{
				now,
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
			"https://discord.com/api/v10/invites/abc123?with_counts=true",
		);
		expect(metadata).toEqual({
			url: "https://discord.gg/abc123",
			domain: "discord.gg",
			title: "Harune Community",
			description: "Members 12,345",
			image:
				"https://cdn.discordapp.com/icons/123456789012345678/guild_icon.png?size=256",
			siteName: "Discord",
			favicon:
				"https://cdn.harune.me/public/assets/link-provider-icon/discord.svg",
			provider: "discord",
			providerMetadata: {
				provider: "discord",
				viewType: "discord_invite",
				fetchedAt: "2026-05-19T12:00:00.000Z",
				payload: {
					code: "abc123",
					guildId: "123456789012345678",
					guildName: "Harune Community",
					guildDescription: "A friendly place",
					iconUrl:
						"https://cdn.discordapp.com/icons/123456789012345678/guild_icon.png?size=256",
					memberCount: 12345,
					presenceCount: 321,
				},
			},
		});
	});
});
