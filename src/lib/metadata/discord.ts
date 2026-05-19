import { HTTPException } from "hono/http-exception";

import type {
	DiscordInviteMetadata,
	NormalizedMetadata,
} from "../../types/metadata";
import { deriveDomainFromUrl } from "./domain";
import { resolveProviderFaviconUrl } from "./provider-icon";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_HOSTS = new Set([
	"discord.com",
	"www.discord.com",
	"discord.gg",
	"www.discord.gg",
	"discordapp.com",
	"www.discordapp.com",
]);
const DISCORD_RESERVED_PATHS = new Set([
	"api",
	"channels",
	"developers",
	"discover",
	"docs",
	"downloads",
	"invite",
	"login",
	"oauth2",
	"terms",
]);

type DiscordInviteResponse = {
	code?: string;
	guild?: {
		id?: string;
		name?: string;
		description?: string | null;
		icon?: string | null;
		approximate_member_count?: number | null;
		approximate_presence_count?: number | null;
	};
	approximate_member_count?: number | null;
	approximate_presence_count?: number | null;
};

export function isDiscordInviteUrl(url: URL): boolean {
	return extractDiscordInviteCode(url) !== null;
}

export function extractDiscordInviteCode(url: URL): string | null {
	if (!DISCORD_HOSTS.has(url.hostname.toLowerCase())) {
		return null;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	const firstSegment = segments[0]?.trim();
	const secondSegment = segments[1]?.trim();

	if (!firstSegment) {
		return null;
	}

	if (url.hostname.toLowerCase().endsWith("discord.gg")) {
		return DISCORD_RESERVED_PATHS.has(firstSegment.toLowerCase())
			? null
			: firstSegment;
	}

	if (firstSegment.toLowerCase() === "invite" && secondSegment) {
		return secondSegment;
	}

	return null;
}

export async function fetchDiscordMetadata(
	inputUrl: URL,
	options?: {
		now?: Date;
	},
): Promise<NormalizedMetadata> {
	const code = extractDiscordInviteCode(inputUrl);

	if (!code) {
		throw new HTTPException(400, {
			message: "url is not a Discord invite URL",
			cause: { error: "invalid_url" },
		});
	}

	const requestUrl = new URL(`${DISCORD_API_BASE}/invites/${code}`);
	requestUrl.searchParams.set("with_counts", "true");

	const response = await fetch(requestUrl, {
		headers: {
			accept: "application/json",
			"user-agent": "DiscordBot (https://harune.me, 1.0.0)",
		},
	});

	if (!response.ok) {
		throw new HTTPException(response.status === 404 ? 404 : 502, {
			message: "failed to fetch discord invite metadata",
			cause: {
				error: response.status === 404 ? "not_found" : "fetch_failed",
				status: response.status,
			},
		});
	}

	const body = (await response.json()) as DiscordInviteResponse;
	const guild = body.guild ?? {};
	const guildId = typeof guild.id === "string" ? guild.id : null;
	const guildName = typeof guild.name === "string" ? guild.name : null;
	const guildDescription =
		typeof guild.description === "string" ? guild.description : null;
	const memberCount = normalizeNumber(
		guild.approximate_member_count ?? body.approximate_member_count ?? null,
	);
	const presenceCount = normalizeNumber(
		guild.approximate_presence_count ?? body.approximate_presence_count ?? null,
	);
	const iconUrl = buildDiscordGuildIconUrl(guildId, guild.icon);
	const fetchedAt = (options?.now ?? new Date()).toISOString();
	const providerMetadata: DiscordInviteMetadata = {
		provider: "discord",
		viewType: "discord_invite",
		fetchedAt,
		payload: {
			code,
			guildId,
			guildName,
			guildDescription,
			iconUrl,
			memberCount,
			presenceCount,
		},
	};

	return {
		url: `https://discord.gg/${code}`,
		domain: deriveDomainFromUrl(`https://discord.gg/${code}`),
		title: guildName,
		description:
			typeof memberCount === "number"
				? `Members ${memberCount.toLocaleString("en-US")}`
				: guildDescription,
		image: iconUrl,
		siteName: "Discord",
		favicon: resolveProviderFaviconUrl(inputUrl) ?? null,
		provider: "discord",
		providerMetadata,
	};
}

function buildDiscordGuildIconUrl(
	guildId: string | null,
	icon: string | null | undefined,
): string | null {
	if (!guildId || !icon) {
		return null;
	}

	const ext = icon.startsWith("a_") ? "gif" : "png";
	return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=256`;
}

function normalizeNumber(value: number | null | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
