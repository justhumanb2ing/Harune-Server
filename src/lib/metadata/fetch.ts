import { HTTPException } from "hono/http-exception";
import type { NormalizedMetadata } from "../../types/metadata";
import { fetchGithubMetadata, isGithubProfileUrl } from "./github";
import { fetchHeadHtml } from "./head-html";
import { extractMetadata } from "./html";
import { fetchYoutubeMetadata, isYoutubeChannelUrl } from "./youtube";

const MAX_HTML_BYTES = 1_500_000;
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<major>.0.0.0 Safari/537.36";

export async function fetchMetadata(
	initialUrl: URL,
	options?: {
		githubToken?: string | null;
		youtubeApiKey?: string | null;
	},
): Promise<NormalizedMetadata> {
	if (isGithubProfileUrl(initialUrl)) {
		return fetchGithubMetadata(initialUrl, {
			token: options?.githubToken ?? null,
		});
	}

	if (isYoutubeChannelUrl(initialUrl)) {
		return fetchYoutubeMetadata(initialUrl, {
			apiKey: options?.youtubeApiKey ?? null,
			page: () => fetchHeadHtml(initialUrl),
		});
	}

	const page = await fetchHeadHtml(initialUrl);
	if (page.html) {
		return extractMetadata(page.html, page.url);
	}

	const fullHtml = await fetchFullDocument(new URL(page.url));
	return extractMetadata(fullHtml, page.url);
}

async function fetchFullDocument(url: URL): Promise<string> {
	let response: Response;

	try {
		response = await fetch(url.toString(), {
			redirect: "manual",
			headers: {
				accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
				"user-agent": USER_AGENT,
			},
		});
	} catch (error) {
		throw new HTTPException(502, {
			message: "failed to fetch target url",
			cause: {
				error: "fetch_failed",
				reason: error instanceof Error ? error.message : "unknown",
			},
		});
	}

	if (!response.ok) {
		throw new HTTPException(502, {
			message: "target responded with an error status",
			cause: { error: "fetch_failed", status: response.status },
		});
	}

	return readTextWithLimit(response, MAX_HTML_BYTES);
}

async function readTextWithLimit(
	response: Response,
	maxBytes: number,
): Promise<string> {
	if (!response.body) {
		return "";
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	const chunks: string[] = [];
	let totalBytes = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		totalBytes += value.byteLength;
		if (totalBytes > maxBytes) {
			await reader.cancel();
			throw new HTTPException(502, {
				message: "response body is too large",
				cause: { error: "fetch_failed" },
			});
		}

		chunks.push(decoder.decode(value, { stream: true }));
	}

	chunks.push(decoder.decode());
	return chunks.join("");
}
