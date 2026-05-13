import { describe, expect, it } from "vitest";

import { deriveDomainFromUrl } from "../domain";

describe("metadata domain extraction", () => {
	it("normalizes common host prefixes to the registrable domain", () => {
		expect(deriveDomainFromUrl("https://instagram.com/asdklmfalksdmf")).toBe(
			"instagram.com",
		);
		expect(deriveDomainFromUrl("https://threads.com/@jaksdlfaslkdf")).toBe(
			"threads.com",
		);
		expect(
			deriveDomainFromUrl("https://www.youtube.com/@youtubecreators"),
		).toBe("youtube.com");
		expect(deriveDomainFromUrl("https://m.instagram.com/p/abc")).toBe(
			"instagram.com",
		);
	});
});
