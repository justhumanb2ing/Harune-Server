import { describe, expect, it } from "vitest";

import { BASE_ORIGINS, getAllowedOrigins } from "../origins";

describe("getAllowedOrigins", () => {
	it("includes the configured Harune app origin and keeps entries unique", () => {
		const origins = getAllowedOrigins({
			HARUNE_APP_ORIGIN: "https://app.harune.me",
		});

		expect(origins).toEqual([...BASE_ORIGINS, "https://app.harune.me"]);
	});

	it("deduplicates HARUNE_APP_ORIGIN when it matches a base origin", () => {
		const origins = getAllowedOrigins({
			HARUNE_APP_ORIGIN: "https://harune.me",
		});

		expect(origins).toEqual(BASE_ORIGINS);
	});
});
