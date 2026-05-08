import { describe, expect, it } from "vitest";

import { getAuthAdvancedConfig } from "../auth";

describe("getAuthAdvancedConfig", () => {
	it("uses shared harune subdomain cookies in production", () => {
		const config = getAuthAdvancedConfig({
			env: {
				BETTER_AUTH_URL: "https://api.harune.me",
			},
		} as never);

		expect(config?.crossSubDomainCookies).toEqual({
			enabled: true,
			domain: ".harune.me",
		});
		expect(config?.backgroundTasks).toBeDefined();
		expect(config?.ipAddress).toEqual({
			ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
		});
	});

	it("disables production-only cookie handling on localhost", () => {
		const config = getAuthAdvancedConfig({
			env: {
				BETTER_AUTH_URL: "http://localhost:8787",
			},
		} as never);

		expect(config).toBeUndefined();
	});

	it("disables production-only cookie handling when BETTER_AUTH_URL is absent", () => {
		const config = getAuthAdvancedConfig({
			env: {},
		} as never);

		expect(config).toBeUndefined();
	});
});
