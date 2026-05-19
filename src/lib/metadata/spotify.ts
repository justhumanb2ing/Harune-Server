import { HTTPException } from "hono/http-exception";

import type {
	NormalizedMetadata,
	SpotifyOEmbedMetadata,
} from "../../types/metadata";
import { deriveDomainFromUrl } from "./domain";
import { fetchHeadHtml } from "./head-html";
import { extractMetadata, parseAttributes } from "./html";
import { resolveProviderFaviconUrl } from "./provider-icon";

const SPOTIFY_OEMBED_HOSTS = new Set(["open.spotify.com", "spotify.link"]);

type SpotifyOEmbedResponse = {
	html?: string;
	width?: number;
	height?: number;
	version?: string;
	provider_name?: string;
	provider_url?: string;
	type?: string;
	title?: string;
	thumbnail_url?: string;
	thumbnail_width?: number;
	thumbnail_height?: number;
};

export function isSpotifyUrl(url: URL): boolean {
	return SPOTIFY_OEMBED_HOSTS.has(url.hostname.toLowerCase());
}

export async function fetchSpotifyMetadata(
	inputUrl: URL,
	options?: {
		now?: Date;
	},
): Promise<NormalizedMetadata> {
	if (!isSpotifyUrl(inputUrl)) {
		throw new HTTPException(400, {
			message: "url is not a Spotify URL",
			cause: { error: "invalid_url" },
		});
	}

	const page = await fetchHeadHtml(inputUrl);
	const fetchedAt = (options?.now ?? new Date()).toISOString();
	const oembedUrl = extractSpotifyOEmbedUrl(page.html, page.url);

	if (oembedUrl) {
		const oembedMetadata = await fetchSpotifyOEmbedMetadata(
			oembedUrl,
			page.url,
			fetchedAt,
		);
		if (oembedMetadata) {
			return oembedMetadata;
		}
	}

	return extractMetadata(page.html, page.url);
}

async function fetchSpotifyOEmbedMetadata(
	oembedUrl: string,
	pageUrl: string,
	fetchedAt: string,
): Promise<NormalizedMetadata | null> {
	let response: Response;

	try {
		response = await fetch(oembedUrl, {
			headers: {
				accept: "application/json",
				"user-agent": "Harune API",
			},
		});
	} catch {
		return null;
	}

	if (!response.ok) {
		if (response.status === 400 || response.status === 404) {
			return null;
		}

		throw new HTTPException(502, {
			message: "failed to fetch spotify oEmbed metadata",
			cause: { error: "fetch_failed", status: response.status },
		});
	}

	const body = (await response.json()) as SpotifyOEmbedResponse;
	const title = typeof body.title === "string" ? body.title : null;
	const image =
		typeof body.thumbnail_url === "string" ? body.thumbnail_url : null;
	const siteName =
		typeof body.provider_name === "string" ? body.provider_name : "Spotify";
	const providerMetadata: SpotifyOEmbedMetadata = {
		provider: "spotify",
		viewType: "spotify_oembed",
		fetchedAt,
		payload: {
			title,
			html: typeof body.html === "string" ? body.html : null,
			width: typeof body.width === "number" ? body.width : null,
			height: typeof body.height === "number" ? body.height : null,
			version: typeof body.version === "string" ? body.version : null,
			providerName:
				typeof body.provider_name === "string" ? body.provider_name : null,
			providerUrl:
				typeof body.provider_url === "string" ? body.provider_url : null,
			type: typeof body.type === "string" ? body.type : null,
			thumbnailUrl: image,
			thumbnailWidth:
				typeof body.thumbnail_width === "number" ? body.thumbnail_width : null,
			thumbnailHeight:
				typeof body.thumbnail_height === "number"
					? body.thumbnail_height
					: null,
		},
	};

	return {
		url: pageUrl,
		domain: deriveDomainFromUrl(pageUrl),
		title,
		description: null,
		image,
		siteName,
		favicon: resolveProviderFaviconUrl(pageUrl),
		provider: "spotify",
		providerMetadata,
	};
}

function extractSpotifyOEmbedUrl(html: string, pageUrl: string): string | null {
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const attrs = parseAttributes(tag);
		const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
		const type = (attrs.type ?? "").toLowerCase();
		const href = attrs.href?.trim();

		if (!href) {
			continue;
		}

		if (!rel.includes("alternate")) {
			continue;
		}

		if (type !== "application/json+oembed") {
			continue;
		}

		try {
			return new URL(href, pageUrl).toString();
		} catch {
			return null;
		}
	}

	return null;
}
