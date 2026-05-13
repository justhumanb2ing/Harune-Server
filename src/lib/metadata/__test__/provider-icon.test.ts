import { describe, expect, it } from "vitest";

import { resolveProviderFaviconUrl } from "../provider-icon";

describe("metadata provider icons", () => {
	it("resolves canonical provider favicon URLs for supported hosts", () => {
		expect(
			resolveProviderFaviconUrl(new URL("https://m.instagram.com/p/abc")),
		).toBe(
			"https://cdn.harune.me/public/assets/link-provider-icon/instagram.svg",
		);
		expect(
			resolveProviderFaviconUrl(new URL("https://open.spotify.com/track/123")),
		).toBe(
			"https://cdn.harune.me/public/assets/link-provider-icon/spotify.svg",
		);
		expect(
			resolveProviderFaviconUrl(new URL("https://example.com")),
		).toBeNull();
	});
});
