import { describe, expect, it } from "vitest";

import { getDodoPaymentsEnvironment } from "../dodo-payments";

describe("getDodoPaymentsEnvironment", () => {
	it("uses live_mode for the production harune auth url", () => {
		const environment = getDodoPaymentsEnvironment({
			env: {
				BETTER_AUTH_URL: "https://api.harune.me",
			},
		} as never);

		expect(environment).toBe("live_mode");
	});

	it("uses test_mode on localhost", () => {
		const environment = getDodoPaymentsEnvironment({
			env: {
				BETTER_AUTH_URL: "http://localhost:8787",
			},
		} as never);

		expect(environment).toBe("test_mode");
	});

	it("uses test_mode when BETTER_AUTH_URL is absent", () => {
		const environment = getDodoPaymentsEnvironment({
			env: {},
		} as never);

		expect(environment).toBe("test_mode");
	});
});
