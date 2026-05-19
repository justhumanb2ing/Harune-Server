import { HTTPException } from "hono/http-exception";

import type {
	ChzzkChannelMetadata,
	NormalizedMetadata,
} from "../../types/metadata";
import { deriveDomainFromUrl } from "./domain";
import { resolveProviderFaviconUrl } from "./provider-icon";

const CHZZK_CHANNELS_ENDPOINT =
	"https://openapi.chzzk.naver.com/open/v1/channels";
const CHZZK_CHANNEL_HOSTS = new Set(["chzzk.naver.com", "m.chzzk.naver.com"]);

type ChzzkChannelResponse = {
	code?: number | string;
	message?: string | null;
	content?: {
		data?: ChzzkChannelRecord[];
	};
	data?: ChzzkChannelRecord[];
};

type ChzzkChannelRecord = {
	channelId?: unknown;
	channelName?: unknown;
	channelImageUrl?: unknown;
	followerCount?: unknown;
	verifiedMark?: unknown;
};

export function isChzzkChannelUrl(url: URL): boolean {
	return extractChzzkChannelId(url) !== null;
}

export function extractChzzkChannelId(url: URL): string | null {
	if (!CHZZK_CHANNEL_HOSTS.has(url.hostname.toLowerCase())) {
		return null;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	const firstSegment = segments[0]?.trim();
	const secondSegment = segments[1]?.trim();

	if (!firstSegment) {
		return null;
	}

	if (firstSegment === "live" && secondSegment) {
		return secondSegment;
	}

	if (["video", "clips", "category"].includes(firstSegment)) {
		return null;
	}

	return firstSegment;
}

export async function fetchChzzkMetadata(
	inputUrl: URL,
	options: {
		clientId?: string | null;
		clientSecret?: string | null;
		now?: Date;
	},
): Promise<NormalizedMetadata> {
	const channelId = extractChzzkChannelId(inputUrl);

	if (!channelId) {
		throw new HTTPException(400, {
			message: "url is not a CHZZK channel URL",
			cause: { error: "invalid_url" },
		});
	}

	if (!options.clientId || !options.clientSecret) {
		throw new HTTPException(502, {
			message:
				"chzzk metadata requires CHZZK_CLIENT_ID and CHZZK_CLIENT_SECRET",
			cause: { error: "fetch_failed" },
		});
	}

	const requestUrl = new URL(CHZZK_CHANNELS_ENDPOINT);
	requestUrl.searchParams.append("channelIds", channelId);

	const response = await fetch(requestUrl, {
		headers: {
			accept: "application/json",
			"content-type": "application/json",
			"Client-Id": options.clientId,
			"Client-Secret": options.clientSecret,
			"user-agent": "Harune API",
		},
	});

	if (!response.ok) {
		throw new HTTPException(response.status === 404 ? 404 : 502, {
			message: "failed to fetch chzzk channel metadata",
			cause: {
				error: response.status === 404 ? "not_found" : "fetch_failed",
				status: response.status,
			},
		});
	}

	const body = (await response.json()) as ChzzkChannelResponse;
	const channel = getChzzkChannelRecords(body).find(
		(record) => getString(record, "channelId") === channelId,
	);

	if (!channel) {
		throw new HTTPException(404, {
			message: "chzzk channel not found",
			cause: { error: "not_found" },
		});
	}

	const channelName = getString(channel, "channelName");
	const channelImageUrl = getString(channel, "channelImageUrl");
	const followerCount = getNumber(channel, "followerCount");
	const verifiedMark = getBoolean(channel, "verifiedMark");
	const fetchedAt = (options.now ?? new Date()).toISOString();
	const favicon = resolveProviderFaviconUrl(inputUrl);
	const providerMetadata: ChzzkChannelMetadata = {
		provider: "chzzk",
		viewType: "chzzk_channel",
		fetchedAt,
		payload: {
			channelId,
			channelName,
			channelImageUrl,
			followerCount,
			verifiedMark,
		},
	};

	return {
		url: inputUrl.toString(),
		domain: deriveDomainFromUrl(inputUrl.toString()),
		title: channelName,
		description:
			typeof followerCount === "number"
				? `Followers ${followerCount.toLocaleString("en-US")}`
				: null,
		image: channelImageUrl,
		siteName: "CHZZK",
		favicon,
		provider: "chzzk",
		providerMetadata,
	};
}

function getChzzkChannelRecords(
	body: ChzzkChannelResponse,
): ChzzkChannelRecord[] {
	if (Array.isArray(body.content?.data)) {
		return body.content.data;
	}

	if (Array.isArray(body.data)) {
		return body.data;
	}

	return [];
}

function getString(
	record: ChzzkChannelRecord,
	key: keyof ChzzkChannelRecord,
): string | null {
	const value = record[key];
	return typeof value === "string" && value.trim() ? value : null;
}

function getNumber(
	record: ChzzkChannelRecord,
	key: keyof ChzzkChannelRecord,
): number | null {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(
	record: ChzzkChannelRecord,
	key: keyof ChzzkChannelRecord,
): boolean | null {
	const value = record[key];
	return typeof value === "boolean" ? value : null;
}
