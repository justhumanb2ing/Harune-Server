const COMMON_HOST_PREFIXES = ["www.", "m.", "mobile.", "amp."];

export function deriveDomainFromUrl(pageUrl: string): string {
	const hostname = new URL(pageUrl).hostname.toLowerCase();
	return stripCommonPrefixes(hostname);
}

function stripCommonPrefixes(hostname: string): string {
	for (const prefix of COMMON_HOST_PREFIXES) {
		if (hostname.startsWith(prefix)) {
			return hostname.slice(prefix.length);
		}
	}

	return hostname;
}
