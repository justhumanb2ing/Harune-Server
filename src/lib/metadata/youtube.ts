import { HTTPException } from "hono/http-exception";

import type {
	NormalizedMetadata,
	YoutubeChannelMetadata,
	YoutubeVideoMetadata,
} from "../../types/metadata";
import { deriveDomainFromUrl } from "./domain";
import { fetchHeadHtml } from "./head-html";
import { pickBestFavicon } from "./html";
import { resolveProviderFaviconUrl } from "./provider-icon";

const YOUTUBE_API_VIDEOS_ENDPOINT =
	"https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_API_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_FAVICON = "https://www.youtube.com/favicon.ico";
const YOUTUBE_CHANNEL_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
]);
const YOUTUBE_VIDEO_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"youtu.be",
]);
const YOUTUBE_NON_CHANNEL_PATHS = new Set([
	"about",
	"channel",
	"community",
	"featured",
	"feed",
	"feeds",
	"live",
	"playlist",
	"shorts",
	"store",
	"trending",
	"watch",
	"videos",
]);
const YOUTUBE_VIDEO_PATHS = new Set(["embed", "live", "shorts", "v", "watch"]);

type YoutubeChannelsListResponse = {
	items?: Array<{
		id?: string;
		snippet?: Record<string, unknown>;
		statistics?: Record<string, unknown>;
	}>;
};

export function isYoutubeChannelUrl(url: URL): boolean {
	return extractYoutubeChannelCandidate(url) !== null;
}

export function isYoutubeVideoUrl(url: URL): boolean {
	return extractYoutubeVideoId(url) !== null;
}

type YoutubeChannelCandidate = {
	value: string;
	preferredKind: "id" | "handle" | "username" | null;
};

export function extractYoutubeChannelCandidate(
	url: URL,
): YoutubeChannelCandidate | null {
	if (!YOUTUBE_CHANNEL_HOSTS.has(url.hostname.toLowerCase())) {
		return null;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	const firstSegment = segments[0]?.trim();
	const secondSegment = segments[1]?.trim();

	if (!firstSegment) {
		return null;
	}

	if (firstSegment === "channel" && secondSegment) {
		return { value: secondSegment, preferredKind: "id" };
	}

	if (firstSegment === "user" && secondSegment) {
		return { value: secondSegment, preferredKind: "username" };
	}

	if (firstSegment === "c" && secondSegment) {
		return { value: secondSegment, preferredKind: null };
	}

	if (firstSegment.startsWith("@")) {
		const handle = firstSegment.slice(1).trim();
		return handle ? { value: handle, preferredKind: "handle" } : null;
	}

	if (YOUTUBE_NON_CHANNEL_PATHS.has(firstSegment.toLowerCase())) {
		return null;
	}

	return null;
}

export function extractYoutubeVideoId(url: URL): string | null {
	if (!YOUTUBE_VIDEO_HOSTS.has(url.hostname.toLowerCase())) {
		return null;
	}

	if (url.hostname.toLowerCase() === "youtu.be") {
		const videoId = url.pathname.split("/").filter(Boolean)[0]?.trim();
		return videoId ? videoId : null;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	const firstSegment = segments[0]?.trim();
	const secondSegment = segments[1]?.trim();

	if (!firstSegment) {
		return null;
	}

	if (firstSegment.startsWith("@")) {
		return null;
	}

	if (firstSegment === "watch") {
		const videoId = url.searchParams.get("v")?.trim();
		return videoId ? videoId : null;
	}

	if (YOUTUBE_VIDEO_PATHS.has(firstSegment.toLowerCase())) {
		return secondSegment ? secondSegment : null;
	}

	return null;
}

type YoutubeLookupAttempt = {
	kind: "id" | "handle" | "username";
	value: string;
};

function buildYoutubeLookupAttempts(
	candidate: YoutubeChannelCandidate,
): YoutubeLookupAttempt[] {
	const defaultKinds: Array<"handle" | "username" | "id"> = [
		"handle",
		"username",
		"id",
	];
	const orderedKinds: Array<"id" | "handle" | "username"> = [];

	if (candidate.preferredKind) {
		orderedKinds.push(candidate.preferredKind);
	}

	for (const kind of defaultKinds) {
		if (!orderedKinds.includes(kind)) {
			orderedKinds.push(kind);
		}
	}

	return orderedKinds.map((kind) => ({ kind, value: candidate.value }));
}

export async function fetchYoutubeMetadata(
	inputUrl: URL,
	options: {
		apiKey?: string | null;
		now?: Date;
		page?: (() => Promise<{ url: string; html: string }>) | null;
	},
): Promise<NormalizedMetadata> {
	const candidate = extractYoutubeChannelCandidate(inputUrl);

	if (!candidate) {
		throw new HTTPException(400, {
			message: "url is not a YouTube channel URL",
			cause: { error: "invalid_url" },
		});
	}

	if (!options.apiKey) {
		throw new HTTPException(502, {
			message: "youtube metadata requires YOUTUBE_API_KEY",
			cause: { error: "fetch_failed" },
		});
	}

	for (const lookup of buildYoutubeLookupAttempts(candidate)) {
		const requestUrl = new URL(YOUTUBE_API_ENDPOINT);
		requestUrl.searchParams.set("part", "snippet,statistics");
		requestUrl.searchParams.set("key", options.apiKey);

		switch (lookup.kind) {
			case "id":
				requestUrl.searchParams.set("id", lookup.value);
				break;
			case "handle":
				requestUrl.searchParams.set("forHandle", lookup.value);
				break;
			case "username":
				requestUrl.searchParams.set("forUsername", lookup.value);
				break;
		}

		const response = await fetch(requestUrl, {
			headers: {
				accept: "application/json",
				"user-agent": "Harune API",
			},
		});

		if (!response.ok) {
			if (response.status === 400 || response.status === 404) {
				continue;
			}

			throw new HTTPException(502, {
				message: "failed to fetch youtube channel metadata",
				cause: { error: "fetch_failed", status: response.status },
			});
		}

		const body = (await response.json()) as YoutubeChannelsListResponse;
		const channel = body.items?.[0];

		if (!channel || !channel.id) {
			continue;
		}

		const snippet = channel.snippet ?? {};
		const statistics = channel.statistics ?? {};
		const channelUrl = `https://www.youtube.com/channel/${channel.id}`;
		const title = getString(snippet, "title");
		const description = getString(snippet, "description");
		const image = pickBestYoutubeThumbnailUrl(snippet);
		const page = options.page
			? await options.page()
			: await fetchHeadHtml(new URL(channelUrl));
		const favicon =
			resolveProviderFaviconUrl(channelUrl) ??
			pickBestFavicon(page.html, page.url) ??
			YOUTUBE_FAVICON;
		const fetchedAt = (options.now ?? new Date()).toISOString();
		const providerMetadata: YoutubeChannelMetadata = {
			provider: "youtube",
			viewType: "youtube_channel",
			fetchedAt,
			payload: {
				snippet,
				statistics,
			},
		};

		return {
			url: inputUrl.toString(),
			domain: deriveDomainFromUrl(inputUrl.toString()),
			title,
			description,
			image,
			siteName: "YouTube",
			favicon,
			provider: "youtube",
			providerMetadata,
		};
	}

	throw new HTTPException(404, {
		message: "youtube channel not found",
		cause: { error: "not_found" },
	});
}

function getString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = record[key];
	return typeof value === "string" ? value : null;
}

function pickBestYoutubeThumbnailUrl(
	snippet: Record<string, unknown>,
): string | null {
	const thumbnails = snippet.thumbnails;

	if (
		!thumbnails ||
		typeof thumbnails !== "object" ||
		Array.isArray(thumbnails)
	) {
		return null;
	}

	const thumbnailRecord = thumbnails as Record<
		string,
		{ url?: unknown } | Record<string, unknown>
	>;

	for (const key of ["maxres", "standard", "high", "medium", "default"]) {
		const candidate = thumbnailRecord[key];
		const url =
			candidate && typeof candidate === "object" ? candidate.url : null;
		if (typeof url === "string" && url.trim()) {
			return url;
		}
	}

	return null;
}

export async function fetchYoutubeVideoMetadata(
	inputUrl: URL,
	options: {
		apiKey?: string | null;
		now?: Date;
	},
): Promise<NormalizedMetadata> {
	const videoId = extractYoutubeVideoId(inputUrl);

	if (!videoId) {
		throw new HTTPException(400, {
			message: "url is not a YouTube video URL",
			cause: { error: "invalid_url" },
		});
	}

	if (!options.apiKey) {
		throw new HTTPException(502, {
			message: "youtube metadata requires YOUTUBE_API_KEY",
			cause: { error: "fetch_failed" },
		});
	}

	const requestUrl = new URL(YOUTUBE_API_VIDEOS_ENDPOINT);
	requestUrl.searchParams.set("part", "snippet,player,statistics");
	requestUrl.searchParams.set("id", videoId);
	requestUrl.searchParams.set("key", options.apiKey);

	const response = await fetch(requestUrl, {
		headers: {
			accept: "application/json",
			"user-agent": "Harune API",
		},
	});

	if (!response.ok) {
		throw new HTTPException(response.status === 404 ? 404 : 502, {
			message: "failed to fetch youtube video metadata",
			cause: {
				error: response.status === 404 ? "not_found" : "fetch_failed",
				status: response.status,
			},
		});
	}

	const body = (await response.json()) as {
		items?: Array<{
			id?: string;
			snippet?: Record<string, unknown>;
			player?: Record<string, unknown>;
			statistics?: Record<string, unknown>;
		}>;
	};
	const video = body.items?.[0];

	if (!video?.id) {
		throw new HTTPException(404, {
			message: "youtube video not found",
			cause: { error: "not_found" },
		});
	}

	const snippet = video.snippet ?? {};
	const player = video.player ?? {};
	const statistics = video.statistics ?? {};
	const title = getString(snippet, "title");
	const description = getString(snippet, "description");
	const image = pickBestYoutubeThumbnailUrl(snippet);
	const canonicalUrl = `https://www.youtube.com/watch?v=${video.id}`;
	const fetchedAt = (options.now ?? new Date()).toISOString();
	const providerMetadata: YoutubeVideoMetadata = {
		provider: "youtube",
		viewType: "youtube_video",
		fetchedAt,
		payload: {
			videoId: video.id,
			channelId: getString(snippet, "channelId"),
			channelTitle: getString(snippet, "channelTitle"),
			snippet,
			statistics,
			player,
		},
	};

	return {
		url: canonicalUrl,
		domain: deriveDomainFromUrl(canonicalUrl),
		title,
		description,
		image,
		siteName: "YouTube",
		favicon: resolveProviderFaviconUrl(canonicalUrl) ?? YOUTUBE_FAVICON,
		provider: "youtube",
		providerMetadata,
	};
}
