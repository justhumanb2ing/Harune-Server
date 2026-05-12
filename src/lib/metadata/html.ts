import type {
	IconCandidate,
	ImageCandidate,
	NormalizedMetadata,
} from "../../types/metadata";
import { deriveSiteNameFromUrl } from "./site-name";

export function extractMetadata(
	html: string,
	pageUrl: string,
): NormalizedMetadata {
	const titleFromMeta = firstDefined(
		getMetaContents(html, ["og:title", "twitter:title"]),
		getTitleTag(html),
	);
	const description = firstDefined(
		getMetaContents(html, [
			"og:description",
			"twitter:description",
			"description",
		]),
		null,
	);
	const siteName = firstDefined(
		getMetaContents(html, [
			"og:site_name",
			"application-name",
			"apple-mobile-web-app-title",
		]),
		deriveSiteNameFromUrl(pageUrl),
	);

	const canonicalUrl = firstDefined(
		findCanonicalUrl(html, pageUrl),
		getMetaContents(html, ["og:url"]),
		pageUrl,
	);

	const image = pickBestImage(html, pageUrl);
	const favicon = pickBestFavicon(html, pageUrl);

	return {
		url: pageUrl,
		canonicalUrl,
		title: titleFromMeta,
		description,
		image,
		siteName,
		favicon,
		provider: null,
		providerMetadata: null,
	};
}

function getTitleTag(html: string): string | null {
	const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
	if (!match?.[1]) {
		return null;
	}

	return cleanText(decodeHtmlEntities(stripTags(match[1])));
}

function getMetaContents(html: string, keys: string[]): string | null {
	const targetKeys = new Set(keys.map((key) => key.toLowerCase()));
	const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];

	for (const tag of metaTags) {
		const attrs = parseAttributes(tag);
		const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
		const content = attrs.content ?? attrs.href ?? null;

		if (key && content && targetKeys.has(key)) {
			return cleanText(decodeHtmlEntities(content));
		}
	}

	return null;
}

function findCanonicalUrl(html: string, pageUrl: string): string | null {
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

	for (const tag of linkTags) {
		const attrs = parseAttributes(tag);
		const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/);
		if (!rel.includes("canonical")) {
			continue;
		}

		const href = attrs.href;
		if (!href) {
			continue;
		}

		return resolveUrl(href, pageUrl);
	}

	return null;
}

function pickBestImage(html: string, pageUrl: string): string | null {
	const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
	const candidates: ImageCandidate[] = [];
	let currentOgCandidate: ImageCandidate | null = null;
	let order = 0;

	for (const tag of metaTags) {
		const attrs = parseAttributes(tag);
		const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
		const content = attrs.content?.trim();

		if (!content) {
			continue;
		}

		if (
			key === "og:image" ||
			key === "og:image:url" ||
			key === "og:image:secure_url"
		) {
			currentOgCandidate = {
				url: resolveUrl(content, pageUrl),
				width: null,
				height: null,
				order,
				source: "og",
			};
			candidates.push(currentOgCandidate);
			order += 1;
			continue;
		}

		if (key === "og:image:width" && currentOgCandidate) {
			currentOgCandidate.width = parsePositiveNumber(content);
			continue;
		}

		if (key === "og:image:height" && currentOgCandidate) {
			currentOgCandidate.height = parsePositiveNumber(content);
			continue;
		}

		if (key === "twitter:image" || key === "twitter:image:src") {
			candidates.push({
				url: resolveUrl(content, pageUrl),
				width: null,
				height: null,
				order,
				source: "twitter",
			});
			order += 1;
		}
	}

	const best = candidates
		.map((candidate) => ({
			candidate,
			score: scoreImageCandidate(candidate),
		}))
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.candidate.order - right.candidate.order,
		)[0];

	return best?.candidate.url ?? null;
}

export function pickBestFavicon(html: string, pageUrl: string): string | null {
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
	const candidates: IconCandidate[] = [];
	let order = 0;

	for (const tag of linkTags) {
		const attrs = parseAttributes(tag);
		const rel = (attrs.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
		if (
			!rel.some(
				(value) =>
					value === "icon" ||
					value === "shortcut" ||
					value === "shortcut-icon" ||
					value === "apple-touch-icon" ||
					value === "apple-touch-icon-precomposed",
			)
		) {
			continue;
		}

		const href = attrs.href?.trim();
		if (!href) {
			continue;
		}

		candidates.push({
			url: resolveUrl(href, pageUrl),
			score: scoreIconCandidate(attrs),
			order,
		});
		order += 1;
	}

	const fallback = new URL("/favicon.ico", pageUrl).toString();
	const best = candidates.sort(
		(left, right) => right.score - left.score || left.order - right.order,
	)[0];

	return best?.url ?? fallback;
}

function scoreImageCandidate(candidate: ImageCandidate): number {
	if (isSvgUrl(candidate.url)) {
		return Number.MAX_SAFE_INTEGER;
	}

	if (candidate.width && candidate.height) {
		return candidate.width * candidate.height;
	}

	if (candidate.width) {
		return candidate.width * candidate.width;
	}

	if (candidate.height) {
		return candidate.height * candidate.height;
	}

	return candidate.source === "og" ? 1 : 0;
}

function scoreIconCandidate(attrs: Record<string, string>): number {
	const href = attrs.href ?? "";
	const sizes = attrs.sizes ?? "";
	const type = (attrs.type ?? "").toLowerCase();

	if (type.includes("svg") || isSvgUrl(href)) {
		return Number.MAX_SAFE_INTEGER;
	}

	const parsedSizes = parseIconSizes(sizes);
	if (parsedSizes.length > 0) {
		return Math.max(...parsedSizes.map(([width, height]) => width * height));
	}

	return 1;
}

function parseIconSizes(rawSizes: string): Array<[number, number]> {
	if (!rawSizes) {
		return [];
	}

	const sizes = rawSizes
		.toLowerCase()
		.split(/\s+/)
		.map((part) => part.trim())
		.filter(Boolean);

	const parsed: Array<[number, number]> = [];

	for (const size of sizes) {
		if (size === "any") {
			parsed.push([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
			continue;
		}

		const match = size.match(/^(\d+)[x×](\d+)$/);
		if (!match) {
			continue;
		}

		parsed.push([Number(match[1]), Number(match[2])]);
	}

	return parsed;
}

function parseAttributes(tag: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	const attributePattern =
		/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

	for (const match of tag.matchAll(attributePattern)) {
		const key = match[1].toLowerCase();
		const value = match[2] ?? match[3] ?? match[4] ?? "";
		attributes[key] = decodeHtmlEntities(value);
	}

	return attributes;
}

function cleanText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
	return value.replace(/<[^>]*>/g, "");
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#(\d+);/g, (_, code: string) =>
			String.fromCharCode(Number(code)),
		)
		.replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
			String.fromCharCode(Number.parseInt(code, 16)),
		);
}

function parsePositiveNumber(value: string): number | null {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

function firstDefined<T>(...values: Array<T | null | undefined>): T | null {
	for (const value of values) {
		if (value !== null && value !== undefined && value !== "") {
			return value;
		}
	}

	return null;
}

function isSvgUrl(value: string): boolean {
	return /\.svg(?:$|\?)/i.test(value);
}

function resolveUrl(value: string, baseUrl: string): string {
	try {
		return new URL(value, baseUrl).toString();
	} catch {
		return value;
	}
}
