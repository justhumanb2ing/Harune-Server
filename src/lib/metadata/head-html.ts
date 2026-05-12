import { HTTPException } from "hono/http-exception";
import { resolveAndValidateUrl } from "./url";

const MAX_HEAD_BYTES = 128_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<major>.0.0.0 Safari/537.36";

export type MetadataHeadHtml = {
	url: string;
	html: string;
};

export async function fetchHeadHtml(
	initialUrl: URL,
	options?: {
		maxBytes?: number;
		maxRedirects?: number;
		userAgent?: string;
	},
): Promise<MetadataHeadHtml> {
	let currentUrl = initialUrl;
	const maxBytes = options?.maxBytes ?? MAX_HEAD_BYTES;
	const maxRedirects = options?.maxRedirects ?? MAX_REDIRECTS;
	const userAgent = options?.userAgent ?? USER_AGENT;

	for (
		let redirectCount = 0;
		redirectCount <= maxRedirects;
		redirectCount += 1
	) {
		let response: Response;

		try {
			response = await fetch(currentUrl.toString(), {
				redirect: "manual",
				headers: {
					accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
					"user-agent": userAgent,
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

		if (isRedirectStatus(response.status)) {
			const location = response.headers.get("location");
			if (!location) {
				throw new HTTPException(502, {
					message: "redirect response missing location header",
					cause: { error: "fetch_failed" },
				});
			}

			currentUrl = resolveAndValidateUrl(location, currentUrl);
			continue;
		}

		if (!response.ok) {
			throw new HTTPException(502, {
				message: "target responded with an error status",
				cause: { error: "fetch_failed", status: response.status },
			});
		}

		return {
			url: currentUrl.toString(),
			html: await readHeadTextWithLimit(response, maxBytes),
		};
	}

	throw new HTTPException(502, {
		message: "too many redirects",
		cause: { error: "fetch_failed" },
	});
}

function isRedirectStatus(status: number): boolean {
	return status >= 300 && status < 400;
}

async function readHeadTextWithLimit(
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
	let buffer = "";
	const marker = "</head>";

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		totalBytes += value.byteLength;
		if (totalBytes > maxBytes) {
			await reader.cancel();
			return chunks.join("") + buffer;
		}

		buffer += decoder.decode(value, { stream: true });
		const markerIndex = buffer.toLowerCase().indexOf(marker);
		if (markerIndex !== -1) {
			chunks.push(buffer.slice(0, markerIndex + marker.length));
			await reader.cancel();
			return chunks.join("") + decoder.decode();
		}
	}

	chunks.push(buffer, decoder.decode());
	return chunks.join("");
}
