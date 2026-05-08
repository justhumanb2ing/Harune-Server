import { describe, expect, it } from "vitest";

import openApi from "../openapi.json";

function collectEmptyOneOf(node: unknown, path: string[] = []): string[] {
	if (!node || typeof node !== "object") {
		return [];
	}

	if (Array.isArray(node)) {
		return node.flatMap((value, index) =>
			collectEmptyOneOf(value, path.concat(String(index))),
		);
	}

	const record = node as Record<string, unknown>;
	const hits: string[] = [];

	if (Array.isArray(record.oneOf) && record.oneOf.some((item) => {
		return item && typeof item === "object" && Object.keys(item as object).length === 0;
	})) {
		hits.push(path.join("."));
	}

	for (const [key, value] of Object.entries(record)) {
		hits.push(...collectEmptyOneOf(value, path.concat(key)));
	}

	return hits;
}

describe("OpenAPI contract", () => {
	it("exposes stable operation ids for generated client code", () => {
		expect(openApi.paths?.["/metadata"]?.get?.operationId).toBe("getMetadata");
		expect(openApi.paths?.["/handle/check"]?.get?.operationId).toBe(
			"checkHandleAvailability",
		);
		expect(openApi.paths?.["/handle"]?.patch?.operationId).toBe("updateHandle");
		expect(openApi.paths?.["/handle"]?.patch?.requestBody).toBeDefined();
		expect(openApi.paths?.["/me"]?.get?.operationId).toBe("getMe");
		expect(openApi.paths?.["/me/analytics"]?.get?.operationId).toBe(
			"getMeAnalytics",
		);
		expect(openApi.paths?.["/profile/me"]?.post?.operationId).toBe(
			"createProfilePage",
		);
		expect(openApi.paths?.["/profile/me"]?.post?.requestBody).toBeDefined();
		expect(openApi.paths?.["/profile/image"]?.post?.operationId).toBe(
			"uploadProfileImage",
		);
		expect(openApi.paths?.["/profile/image"]?.patch?.operationId).toBe(
			"finalizeProfileImage",
		);
		expect(openApi.paths?.["/profile/image"]?.delete?.operationId).toBe(
			"deleteProfileImage",
		);
		expect(
			openApi.paths?.["/profile/bento/media/upload"]?.post?.operationId,
		).toBe("uploadProfileBentoMedia");
		expect(openApi.paths?.["/profile/{handle}"]?.get?.operationId).toBe(
			"getProfileByHandle",
		);
	});

	it("does not leave default responses behind", () => {
		for (const [path, methods] of Object.entries(openApi.paths ?? {})) {
			for (const [method, operation] of Object.entries(methods)) {
				const responses = (operation as { responses?: Record<string, unknown> }).responses;
				expect(responses?.default).toBeUndefined();
			}
		}
	});

	it("does not contain empty oneOf branches that degrade type generation", () => {
		const hits = collectEmptyOneOf(openApi);
		expect(hits).toEqual([]);
	});

	it("keeps nullable numeric fields explicit in analytics responses", () => {
		const analytics = openApi.paths?.["/me/analytics"]?.get?.responses?.["200"];
		const schema = (analytics as {
			content?: Record<string, { schema?: Record<string, unknown> }>;
		})?.content?.["application/json"]?.schema;

		expect(schema).toBeDefined();
		const schemaText = JSON.stringify(schema);
		expect(schemaText).toContain('"percent":{"type":"number","nullable":true}');
		expect(schemaText).toContain('"changePercent":{"type":"number","nullable":true}');
	});

	it("only exposes supported profile bento variants in the response contract", () => {
		const profile = openApi.paths?.["/profile/{handle}"]?.get?.responses?.["200"];
		const schema = (profile as {
			content?: Record<string, { schema?: { properties?: { bento?: { items?: { oneOf?: Array<{ properties?: { type?: { enum?: string[] } } }> } } } } }>;
		})?.content?.["application/json"]?.schema;
		const types =
			schema?.properties?.bento?.items?.oneOf?.flatMap((item) => item.properties?.type?.enum ?? []) ?? [];

		expect(types).toEqual(["link", "text", "section", "media", "map"]);
	});
});
