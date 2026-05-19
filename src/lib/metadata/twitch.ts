import { HTTPException } from "hono/http-exception";

import type {
	NormalizedMetadata,
	TwitchChannelMetadata,
} from "../../types/metadata";
import { deriveDomainFromUrl } from "./domain";
import { resolveProviderFaviconUrl } from "./provider-icon";

const TWITCH_API_BASE = "https://api.twitch.tv/helix";
const TWITCH_FAVICON =
	"https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png";
const TWITCH_HOSTS = new Set(["twitch.tv", "www.twitch.tv", "m.twitch.tv"]);
const TWITCH_RESERVED_PATHS = new Set([
	"browse",
	"directory",
	"downloads",
	"drops",
	"events",
	"explore",
	"friends",
	"help",
	"inventory",
	"login",
	"messages",
	"p",
	"payments",
	"prime",
	"products",
	"rewards",
	"search",
	"settings",
	"subscriptions",
	"support",
	"turbo",
	"videos",
]);

type TwitchUsersResponse = {
	data?: Array<{
		id?: string;
		login?: string;
		display_name?: string;
		description?: string;
		profile_image_url?: string;
		offline_image_url?: string;
		view_count?: number;
	}>;
};

type TwitchFollowersResponse = {
	total?: number;
};

export function isTwitchChannelUrl(url: URL): boolean {
	return extractTwitchChannelLogin(url) !== null;
}

export function extractTwitchChannelLogin(url: URL): string | null {
	if (!TWITCH_HOSTS.has(url.hostname.toLowerCase())) {
		return null;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	const firstSegment = segments[0]?.trim();

	if (!firstSegment) {
		return null;
	}

	if (TWITCH_RESERVED_PATHS.has(firstSegment.toLowerCase())) {
		return null;
	}

	return firstSegment;
}

export async function fetchTwitchMetadata(
	inputUrl: URL,
	options: {
		clientId?: string | null;
		accessToken?: string | null;
		now?: Date;
	},
): Promise<NormalizedMetadata> {
	const login = extractTwitchChannelLogin(inputUrl);

	if (!login) {
		throw new HTTPException(400, {
			message: "url is not a Twitch channel URL",
			cause: { error: "invalid_url" },
		});
	}

	if (!options.clientId || !options.accessToken) {
		throw new HTTPException(502, {
			message:
				"twitch metadata requires TWITCH_CLIENT_ID and TWITCH_USER_ACCESS_TOKEN",
			cause: { error: "fetch_failed" },
		});
	}

	const userRequestUrl = new URL(`${TWITCH_API_BASE}/users`);
	userRequestUrl.searchParams.set("login", login);

	const userResponse = await fetch(userRequestUrl, {
		headers: {
			accept: "application/json",
			"Client-Id": options.clientId,
			authorization: `Bearer ${options.accessToken}`,
			"user-agent": "Harune API",
		},
	});

	if (!userResponse.ok) {
		throw new HTTPException(userResponse.status === 404 ? 404 : 502, {
			message: "failed to fetch twitch user metadata",
			cause: {
				error: userResponse.status === 404 ? "not_found" : "fetch_failed",
				status: userResponse.status,
			},
		});
	}

	const userBody = (await userResponse.json()) as TwitchUsersResponse;
	const user = userBody.data?.[0];

	if (!user?.id || !user.login) {
		throw new HTTPException(404, {
			message: "twitch channel not found",
			cause: { error: "not_found" },
		});
	}

	const followersRequestUrl = new URL(`${TWITCH_API_BASE}/channels/followers`);
	followersRequestUrl.searchParams.set("broadcaster_id", user.id);

	const followersResponse = await fetch(followersRequestUrl, {
		headers: {
			accept: "application/json",
			"Client-Id": options.clientId,
			authorization: `Bearer ${options.accessToken}`,
			"user-agent": "Harune API",
		},
	});

	if (!followersResponse.ok) {
		throw new HTTPException(502, {
			message: "failed to fetch twitch follower count",
			cause: {
				error: "fetch_failed",
				status: followersResponse.status,
			},
		});
	}

	const followersBody =
		(await followersResponse.json()) as TwitchFollowersResponse;
	const followerCount = normalizeNumber(followersBody.total ?? null);
	const title = user.display_name ?? user.login;
	const description = user.description ?? null;
	const fetchedAt = (options.now ?? new Date()).toISOString();
	const profileUrl = `https://www.twitch.tv/${user.login}`;
	const providerMetadata: TwitchChannelMetadata = {
		provider: "twitch",
		viewType: "twitch_channel",
		fetchedAt,
		payload: {
			broadcasterId: user.id,
			broadcasterLogin: user.login,
			broadcasterName: user.display_name ?? null,
			displayName: user.display_name ?? null,
			description,
			profileImageUrl: user.profile_image_url ?? null,
			offlineImageUrl: user.offline_image_url ?? null,
			followerCount,
			viewCount: normalizeNumber(user.view_count ?? null),
		},
	};

	return {
		url: profileUrl,
		domain: deriveDomainFromUrl(profileUrl),
		title,
		description:
			typeof followerCount === "number"
				? `Followers ${followerCount.toLocaleString("en-US")}`
				: description,
		image: user.profile_image_url ?? null,
		siteName: "Twitch",
		favicon: resolveProviderFaviconUrl(profileUrl) ?? TWITCH_FAVICON,
		provider: "twitch",
		providerMetadata,
	};
}

function normalizeNumber(value: number | null | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}
