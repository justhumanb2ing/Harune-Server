import { readFile, writeFile } from "node:fs/promises";

const openApiPath = "./src/generated/openapi.json";

type OpenApiDocument = {
	paths?: Record<string, Record<string, unknown>>;
};

const raw = await readFile(openApiPath, "utf8");
const openApi = JSON.parse(raw) as OpenApiDocument;

const metadataGet = openApi.paths?.["/metadata"]?.get as
	| {
			parameters?: unknown[];
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!metadataGet) {
	throw new Error("Could not find /metadata GET operation in openapi.json");
}

metadataGet.responses = metadataGet.responses ?? {};
metadataGet.responses ??= {};
metadataGet.operationId = "getMetadata";
metadataGet.responses["200"] = {
	description: "Successful metadata response.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					url: { type: "string" },
					canonicalUrl: { type: "string", nullable: true },
					title: { type: "string", nullable: true },
					description: { type: "string", nullable: true },
					image: { type: "string", nullable: true },
					siteName: { type: "string", nullable: true },
					favicon: { type: "string", nullable: true },
					provider: { type: "string", nullable: true },
					providerMetadata: {
						type: "object",
						nullable: true,
						properties: {
							provider: { type: "string" },
							viewType: { type: "string" },
							fetchedAt: { type: "string" },
							payload: {
								type: "object",
								additionalProperties: true,
							},
						},
						required: [
							"provider",
							"viewType",
							"fetchedAt",
							"payload",
						],
					},
				},
				required: [
					"url",
					"canonicalUrl",
					"title",
					"description",
					"image",
					"siteName",
					"favicon",
					"provider",
					"providerMetadata",
				],
			},
			examples: {
				genericMetadata: {
					summary: "Generic webpage metadata",
					value: {
						url: "https://example.com/article",
						canonicalUrl: "https://example.com/article",
						title: "Example article",
						description: "Example description",
						image: "https://example.com/og-image.png",
						siteName: "Example",
						favicon: "https://example.com/favicon.ico",
						provider: null,
						providerMetadata: null,
					},
				},
				githubContributions: {
					summary: "GitHub profile with 31-day contribution calendar",
					value: {
						url: "https://github.com/octocat",
						canonicalUrl: "https://github.com/octocat",
						title: "The Octocat",
						description: null,
						image: "https://avatars.githubusercontent.com/u/583231?v=4",
						siteName: "GitHub",
						favicon: "https://github.githubassets.com/favicons/favicon.svg",
						provider: "github",
						providerMetadata: {
							provider: "github",
							viewType: "github_contributions_31d",
							fetchedAt: "2026-05-12T00:00:00.000Z",
							payload: {
								login: "octocat",
								name: "The Octocat",
								avatarUrl:
									"https://avatars.githubusercontent.com/u/583231?v=4",
								profileUrl: "https://github.com/octocat",
								rangeStart: "2026-04-12",
								rangeEnd: "2026-05-12",
								totalContributions: 31,
								days: [
									{
										date: "2026-05-12",
										contributionCount: 4,
										contributionLevel: "FIRST_QUARTILE",
										color: "#39d353",
										weekday: 2,
									},
								],
							},
						},
					},
				},
			},
		},
	},
};

metadataGet.responses["400"] = {
	description:
		"Invalid URL request. Returned when the url query parameter is missing, empty, malformed, or uses an unsupported protocol.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						additionalProperties: false,
						properties: {
							code: {
								type: "string",
								enum: [
									"missing_url",
									"invalid_url",
									"invalid_protocol",
									"blocked_host",
								],
							},
							message: { type: "string" },
							details: {
								type: "object",
								additionalProperties: false,
								properties: {
									rawUrl: { type: "string" },
									protocol: { type: "string" },
									hostname: { type: "string" },
								},
							},
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				missingUrl: {
					summary: "Missing url",
					value: {
						error: {
							code: "missing_url",
							message: "url query parameter is required",
						},
					},
				},
				invalidUrl: {
					summary: "Malformed url",
					value: {
						error: {
							code: "invalid_url",
							message: "url must be a valid absolute URL",
							details: {
								rawUrl: "not-a-url",
							},
						},
					},
				},
				invalidProtocol: {
					summary: "Unsupported protocol",
					value: {
						error: {
							code: "invalid_protocol",
							message: "url must use http or https",
							details: {
								protocol: "ftp:",
							},
						},
					},
				},
				blockedHost: {
					summary: "Blocked host",
					value: {
						error: {
							code: "blocked_host",
							message: "url points to a blocked host",
							details: {
								hostname: "localhost",
							},
						},
					},
				},
			},
		},
	},
};

metadataGet.responses["404"] = {
	description: "Target was not found.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["not_found"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
		},
	},
};

metadataGet.responses["500"] = {
	description: "Internal metadata processing failure.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["internal_error"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
		},
	},
};

metadataGet.responses["502"] = {
	description: "Upstream metadata fetch failed.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						additionalProperties: false,
						properties: {
							code: { type: "string", enum: ["fetch_failed"] },
							message: { type: "string" },
							details: {
								type: "object",
								additionalProperties: false,
								properties: {
									reason: { type: "string" },
									status: { type: "number" },
								},
							},
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				fetchFailed: {
					summary: "Upstream fetch failed",
					value: {
						error: {
							code: "fetch_failed",
							message: "failed to fetch metadata",
							details: {
								reason: "upstream_timeout",
								status: 504,
							},
						},
					},
				},
			},
		},
	},
};

delete metadataGet.responses.default;

metadataGet.parameters = [
	{
		name: "url",
		in: "query",
		required: true,
		description: "URL to fetch metadata from.",
		schema: {
			type: "string",
		},
	},
];

const handleGet = openApi.paths?.["/handle/check"]?.get as
	| {
			parameters?: unknown[];
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!handleGet) {
	throw new Error("Could not find /handle/check GET operation in openapi.json");
}

handleGet.operationId = "checkHandleAvailability";

const billingProductsGet = openApi.paths?.["/billing/products"]?.get as
	| {
			summary?: string;
			description?: string;
			parameters?: unknown[];
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!billingProductsGet) {
	throw new Error(
		"Could not find /billing/products GET operation in openapi.json",
	);
}

billingProductsGet.operationId = "listBillingProducts";
billingProductsGet.summary = "List billing plans";
billingProductsGet.description =
	"Returns the locally configured billing plans from `plans`, including the free plan. The route is public and does not require a session. Rows without monthly pricing keep `price` null and fall back to the plan id for `productId`. The response is `Cache-Control: no-store`.";
billingProductsGet.responses = billingProductsGet.responses ?? {};
billingProductsGet.responses["200"] = {
	description:
		"Successful billing plan list response. Includes the free plan and monthly billable plans with a Dodo product mapping.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					items: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								id: { type: "string" },
								slug: { type: "string" },
								productId: {
									type: "string",
									description:
										"Dodo product id for paid plans, or the plan id for free plans.",
								},
								name: { type: "string", nullable: true },
								price: {
									type: "number",
									nullable: true,
									description:
										"Monthly price in cents, or null for free plans.",
								},
								default: { type: "boolean" },
								quotas: {
									type: "object",
									nullable: true,
									additionalProperties: false,
									properties: {
										permiumSupport: { type: "boolean" },
										monthlyImages: { type: "number" },
										somethingElse: { type: "string" },
									},
									required: [
										"permiumSupport",
										"monthlyImages",
										"somethingElse",
									],
								},
							},
							required: [
								"id",
								"slug",
								"productId",
								"name",
								"price",
								"default",
								"quotas",
							],
						},
					},
				},
				required: ["items"],
			},
			examples: {
				default: {
					summary: "Billing plan list",
					value: {
						items: [
							{
								id: "plan_free",
								slug: "free",
								productId: "plan_free",
								name: "Free",
								price: null,
								default: true,
								quotas: {
									permiumSupport: false,
									monthlyImages: 10,
									somethingElse: "something",
								},
							},
							{
								id: "plan_pro",
								slug: "pro-plan",
								productId: "pdt_123",
								name: "Pro Plan",
								price: 399,
								default: false,
								quotas: {
									permiumSupport: true,
									monthlyImages: 100,
									somethingElse: "something",
								},
							},
						],
					},
				},
			},
		},
	},
};

billingProductsGet.responses["500"] = {
	description: "Failed to load billing plans from the database.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					error: {
						type: "object",
						additionalProperties: false,
						properties: {
							code: { type: "string", enum: ["billing_products_unavailable"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				upstreamUnavailable: {
					summary: "Database failure",
					value: {
						error: {
							code: "billing_products_unavailable",
							message: "failed to load billing products",
						},
					},
				},
			},
		},
	},
};

delete billingProductsGet.responses.default;
handleGet.responses ??= {};
handleGet.responses["200"] = {
	description:
		"Available when the handle is unused or already owned by the current session user.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					available: { type: "boolean" },
				},
				required: ["available"],
			},
			examples: {
				available: {
					summary: "Handle can be used",
					value: { available: true },
				},
				unavailable: {
					summary: "Handle is already owned by another user",
					value: { available: false },
				},
			},
		},
	},
};

handleGet.responses["400"] = {
	description:
		"Invalid request. Returned when the handle is missing, empty, malformed, or reserved.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						additionalProperties: false,
						properties: {
							code: { type: "string", enum: ["validation_error"] },
							message: { type: "string" },
							details: {
								type: "array",
								items: {
									type: "object",
									additionalProperties: false,
									properties: {
										reason: { type: "string" },
										message: { type: "string" },
										type: { type: "string" },
									},
									required: ["reason", "message", "type"],
								},
							},
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				required: {
					summary: "Missing handle",
					value: {
						error: {
							code: "validation_error",
							message: "invalid request",
						},
					},
				},
				reserved: {
					summary: "Reserved handle",
					value: {
						error: {
							code: "validation_error",
							message: "invalid request",
							details: [
								{
									reason: "reserved",
									message: "handle is reserved",
									type: "validation",
								},
							],
						},
					},
				},
			},
		},
	},
};

handleGet.responses["401"] = {
	description: "Authentication required.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["unauthorized"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				unauthorized: {
					summary: "No session",
					value: {
						error: {
							code: "unauthorized",
							message: "authentication required",
						},
					},
				},
			},
		},
	},
};

handleGet.parameters = [
	{
		name: "handle",
		in: "query",
		required: true,
		description:
			"Handle to check. The server trims whitespace, lowercases the value, and applies the canonical handle validation rules before looking it up in the database.",
		schema: {
			type: "string",
		},
	},
];

delete handleGet.responses.default;

const handlePatch = openApi.paths?.["/handle"]?.patch as
	| {
			parameters?: unknown[];
			requestBody?: unknown;
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!handlePatch) {
	throw new Error("Could not find /handle PATCH operation in openapi.json");
}

handlePatch.operationId = "updateHandle";
handlePatch.requestBody = {
	required: true,
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					handle: {
						type: "string",
					},
				},
				required: ["handle"],
			},
			examples: {
				normal: {
					summary: "Change handle",
					value: {
						handle: "new_handle",
					},
				},
				trimmed: {
					summary: "Whitespace is normalized",
					value: {
						handle: "  New_Handle  ",
					},
				},
			},
		},
	},
};
handlePatch.responses ??= {};
handlePatch.responses["200"] = {
	description:
		"Successful handle update. The server returns the committed profile page snapshot and the previous canonical handle. Same-handle requests are treated as no-ops and still return 200.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					previousHandle: { type: "string" },
					profilePage: {
						type: "object",
						properties: {
							id: { type: "string" },
							handle: { type: "string" },
							name: { type: "string", nullable: true },
							image: { type: "string", nullable: true },
						},
						required: ["id", "handle", "name", "image"],
					},
				},
				required: ["previousHandle", "profilePage"],
			},
			examples: {
				updated: {
					summary: "Handle updated",
					value: {
						previousHandle: "current_handle",
						profilePage: {
							id: "page_123",
							handle: "new_handle",
							name: "Harune",
							image: "https://cdn.harune.me/avatar.png",
						},
					},
				},
				noOp: {
					summary: "Handle already matched",
					value: {
						previousHandle: "current_handle",
						profilePage: {
							id: "page_123",
							handle: "current_handle",
							name: "Harune",
							image: "https://cdn.harune.me/avatar.png",
						},
					},
				},
			},
		},
	},
};

handlePatch.responses["400"] = {
	description:
		"Invalid request. Returned when the handle is missing, empty, malformed, or reserved.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						additionalProperties: false,
						properties: {
							code: {
								type: "string",
								enum: ["validation_error"],
							},
							message: { type: "string" },
							details: {
								type: "array",
								items: {
									type: "object",
									additionalProperties: false,
									properties: {
										reason: { type: "string" },
										message: { type: "string" },
										type: { type: "string" },
									},
									required: ["reason", "message", "type"],
								},
							},
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				missing: {
					summary: "Missing handle",
					value: {
						error: {
							code: "validation_error",
							message: "invalid request",
						},
					},
				},
				reserved: {
					summary: "Reserved handle",
					value: {
						error: {
							code: "validation_error",
							message: "invalid request",
							details: [
								{
									reason: "reserved",
									message: "handle is reserved",
									type: "validation",
								},
							],
						},
					},
				},
			},
		},
	},
};

handlePatch.responses["401"] = {
	description: "Authentication required.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: {
								type: "string",
								enum: ["unauthorized"],
							},
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				unauthorized: {
					summary: "No session",
					value: {
						error: {
							code: "unauthorized",
							message: "authentication required",
						},
					},
				},
			},
		},
	},
};

handlePatch.responses["404"] = {
	description:
		"Returned when the authenticated user does not own a profile page yet.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["profile_not_found"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				notFound: {
					summary: "No profile page",
					value: {
						error: {
							code: "profile_not_found",
							message: "profile page not found",
						},
					},
				},
			},
		},
	},
};

handlePatch.responses["409"] = {
	description: "Returned when another user already owns the requested handle.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["handle_taken"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				taken: {
					summary: "Handle already taken",
					value: {
						error: {
							code: "handle_taken",
							message: "handle already taken",
						},
					},
				},
			},
		},
	},
};

handlePatch.responses["500"] = {
	description:
		"Returned when the updated profile page cannot be reloaded after the write.",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["handle_update_failed"] },
							message: { type: "string" },
						},
						required: ["code", "message"],
					},
				},
				required: ["error"],
			},
			examples: {
				updateFailed: {
					summary: "Failed to reload updated page",
					value: {
						error: {
							code: "handle_update_failed",
							message: "failed to load updated profile page",
						},
					},
				},
			},
		},
	},
};

delete handlePatch.responses.default;

const meGet = openApi.paths?.["/me"]?.get as
	| {
			responses?: Record<string, unknown>;
			summary?: string;
			description?: string;
			tags?: string[];
			operationId?: string;
	  }
	| undefined;

if (!meGet) {
	throw new Error("Could not find /me GET operation in openapi.json");
}

meGet.summary = "Get current user app context";
meGet.description =
	"Returns the authenticated user's app bootstrap context. `user` is always present, `currentPlan` and `profilePage` can be null, and password data is never exposed.";
meGet.operationId = "getMe";
meGet.tags = ["Me API"];
meGet.responses = {
	200: {
		description:
			"Successful me response. `user` is always present. `currentPlan` and `profilePage` are nullable when the user has no plan or owned profile page.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						currentPlan: {
							type: "object",
							nullable: true,
							properties: {
								id: { type: "string" },
								name: { type: "string" },
								codename: { type: "string" },
								quotas: {
									type: "object",
									properties: {
										permiumSupport: {
											type: "boolean",
										},
										monthlyImages: {
											type: "number",
										},
										somethingElse: {
											type: "string",
										},
									},
									required: [
										"permiumSupport",
										"monthlyImages",
										"somethingElse",
									],
								},
								default: { type: "boolean" },
							},
							required: ["id", "name", "codename", "quotas", "default"],
						},
						profilePage: {
							type: "object",
							nullable: true,
							properties: {
								id: { type: "string" },
								handle: { type: "string" },
								name: { type: "string", nullable: true },
								image: { type: "string", nullable: true },
							},
							required: ["id", "handle", "name", "image"],
						},
						user: {
							type: "object",
							properties: {
								id: { type: "string" },
								email: { type: "string" },
								name: { type: "string", nullable: true },
								image: { type: "string", nullable: true },
								createdAt: { type: "string", format: "date-time" },
								updatedAt: { type: "string", format: "date-time" },
								planId: { type: "string", nullable: true },
								credits: {
									type: "object",
									additionalProperties: {
										type: "number",
									},
								},
							},
							required: [
								"id",
								"email",
								"name",
								"image",
								"createdAt",
								"updatedAt",
								"planId",
								"credits",
							],
						},
					},
					required: ["currentPlan", "profilePage", "user"],
				},
				examples: {
					default: {
						value: {
							currentPlan: {
								id: "plan_123",
								name: "Pro",
								codename: "pro",
								quotas: {
									permiumSupport: true,
									monthlyImages: 100,
									somethingElse: "something",
								},
								default: false,
							},
							profilePage: {
								id: "page_123",
								handle: "harune",
								name: "Harune",
								image: "https://cdn.harune.me/avatar.png",
							},
							user: {
								id: "user_123",
								email: "user@example.com",
								name: "User",
								image: null,
								createdAt: "2026-05-07T00:00:00.000Z",
								updatedAt: "2026-05-07T00:00:00.000Z",
								planId: "plan_123",
								credits: {
									upload: 12,
								},
							},
						},
					},
				},
			},
		},
	},
	401: {
		description: "Authentication required.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string", enum: ["unauthorized"] },
								message: { type: "string" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
				examples: {
					unauthorized: {
						summary: "No session",
						value: {
							error: {
								code: "unauthorized",
								message: "authentication required",
							},
						},
					},
				},
			},
		},
	},
	404: {
		description: "No user-owned app context exists for the current session.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string", enum: ["me_not_found"] },
								message: { type: "string" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
			},
		},
	},
	500: {
		description:
			"Internal me data is inconsistent. This usually means a required user, plan, or profile row is missing.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string" },
								message: { type: "string" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
			},
		},
	},
};

const meAnalyticsGet = openApi.paths?.["/me/analytics"]?.get as
	| {
			responses?: Record<string, unknown>;
			summary?: string;
			description?: string;
			tags?: string[];
			operationId?: string;
	  }
	| undefined;

if (!meAnalyticsGet) {
	throw new Error("Could not find /me/analytics GET operation in openapi.json");
}

const analyticsSummarySchema = {
	type: "object",
	properties: {
		endAt: { type: "number" },
		label: { type: "string" },
		startAt: { type: "number" },
		timezone: { type: "string" },
		unit: { type: "string", enum: ["day", "hour"] },
		ctr: { type: "number" },
		linkClicks: { type: "number" },
		pageViews: { type: "number" },
		changes: {
			type: "object",
			properties: {
				ctr: {
					type: "object",
					properties: {
						absolute: { type: "number" },
						direction: { type: "string", enum: ["down", "flat", "up"] },
						percent: { type: "number", nullable: true },
						previous: { type: "number" },
					},
					required: ["absolute", "direction", "percent", "previous"],
				},
				linkClicks: {
					type: "object",
					properties: {
						absolute: { type: "number" },
						direction: { type: "string", enum: ["down", "flat", "up"] },
						percent: { type: "number", nullable: true },
						previous: { type: "number" },
					},
					required: ["absolute", "direction", "percent", "previous"],
				},
				pageViews: {
					type: "object",
					properties: {
						absolute: { type: "number" },
						direction: { type: "string", enum: ["down", "flat", "up"] },
						percent: { type: "number", nullable: true },
						previous: { type: "number" },
					},
					required: ["absolute", "direction", "percent", "previous"],
				},
			},
			required: ["ctr", "linkClicks", "pageViews"],
		},
		previous: {
			type: "object",
			properties: {
				endAt: { type: "number" },
				label: { type: "string" },
				startAt: { type: "number" },
				timezone: { type: "string" },
				unit: { type: "string", enum: ["day", "hour"] },
				ctr: { type: "number" },
				linkClicks: { type: "number" },
				pageViews: { type: "number" },
			},
			required: [
				"endAt",
				"label",
				"startAt",
				"timezone",
				"unit",
				"ctr",
				"linkClicks",
				"pageViews",
			],
		},
		series: {
			type: "array",
			items: {
				type: "object",
				properties: {
					ctr: { type: "number" },
					linkClicks: { type: "number" },
					pageViews: { type: "number" },
					timestamp: { type: "number" },
				},
				required: ["ctr", "linkClicks", "pageViews", "timestamp"],
			},
		},
		topItems: {
			type: "array",
			items: {
				type: "object",
				properties: {
					change: { type: "number" },
					changePercent: { type: "number", nullable: true },
					clicks: { type: "number" },
					kind: { type: "string", enum: ["link", "social"] },
					label: { type: "string" },
					previousClicks: { type: "number" },
					share: { type: "number" },
				},
				required: [
					"change",
					"changePercent",
					"clicks",
					"kind",
					"label",
					"previousClicks",
					"share",
				],
			},
		},
	},
	required: [
		"endAt",
		"label",
		"startAt",
		"timezone",
		"unit",
		"ctr",
		"linkClicks",
		"pageViews",
		"changes",
		"previous",
		"series",
		"topItems",
	],
} as const;

const analyticsTodayExample = {
	endAt: 1715068799999,
	label: "Today",
	startAt: 1714982400000,
	timezone: "Asia/Seoul",
	unit: "hour",
	ctr: 18,
	linkClicks: 9,
	pageViews: 50,
	changes: {
		ctr: { absolute: 2, direction: "up", percent: 12.5, previous: 16 },
		linkClicks: { absolute: 1, direction: "up", percent: 12.5, previous: 8 },
		pageViews: { absolute: 5, direction: "up", percent: 11.1, previous: 45 },
	},
	previous: {
		endAt: 1714982399999,
		label: "Yesterday",
		startAt: 1714896000000,
		timezone: "Asia/Seoul",
		unit: "hour",
		ctr: 16,
		linkClicks: 8,
		pageViews: 45,
	},
	series: [],
	topItems: [],
} as const;

const analytics7dExample = {
	endAt: 1715068799999,
	label: "Last 7 days",
	startAt: 1714464000000,
	timezone: "Asia/Seoul",
	unit: "day",
	ctr: 22,
	linkClicks: 33,
	pageViews: 150,
	changes: {
		ctr: { absolute: 4, direction: "up", percent: 22.2, previous: 18 },
		linkClicks: { absolute: 6, direction: "up", percent: 22.2, previous: 27 },
		pageViews: { absolute: 15, direction: "up", percent: 11.1, previous: 135 },
	},
	previous: {
		endAt: 1714463999999,
		label: "Previous 7 days",
		startAt: 1713859200000,
		timezone: "Asia/Seoul",
		unit: "day",
		ctr: 18,
		linkClicks: 27,
		pageViews: 135,
	},
	series: [],
	topItems: [],
} as const;

const analytics30dExample = {
	endAt: 1715068799999,
	label: "Last 30 days",
	startAt: 1712380800000,
	timezone: "Asia/Seoul",
	unit: "day",
	ctr: 24,
	linkClicks: 120,
	pageViews: 500,
	changes: {
		ctr: { absolute: 3, direction: "up", percent: 14.3, previous: 21 },
		linkClicks: { absolute: 20, direction: "up", percent: 20, previous: 100 },
		pageViews: { absolute: 50, direction: "up", percent: 11.1, previous: 450 },
	},
	previous: {
		endAt: 1712380799999,
		label: "Previous 30 days",
		startAt: 1709798400000,
		timezone: "Asia/Seoul",
		unit: "day",
		ctr: 21,
		linkClicks: 100,
		pageViews: 450,
	},
	series: [],
	topItems: [],
} as const;

meAnalyticsGet.summary = "Get current user analytics summary";
meAnalyticsGet.description =
	"Returns the authenticated owner's analytics summary for the current profile page. The response is a stateful DTO with ready, no-profile, and disabled variants. The server normalizes timezone input, reads ownership from the authenticated session, and returns no-store headers on success.";
meAnalyticsGet.operationId = "getMeAnalytics";
meAnalyticsGet.tags = ["Me API"];
meAnalyticsGet.responses = {
	200: {
		description:
			"Analytics summary response. `state` identifies whether analytics is ready, disabled, or the user has no owned profile page.",
		content: {
			"application/json": {
				schema: {
					oneOf: [
						{
							type: "object",
							properties: {
								profilePageId: { type: "string" },
								state: { type: "string", enum: ["ready"] },
								timezone: { type: "string" },
								summaries: {
									type: "object",
									properties: {
										today: analyticsSummarySchema,
										"7d": analyticsSummarySchema,
										"30d": analyticsSummarySchema,
									},
									required: ["today", "7d", "30d"],
								},
							},
							required: ["profilePageId", "state", "summaries", "timezone"],
						},
						{
							type: "object",
							properties: {
								profilePageId: { type: "null" },
								state: { type: "string", enum: ["no-profile"] },
								timezone: { type: "string" },
								summaries: {
									type: "object",
									properties: {
										today: analyticsSummarySchema,
										"7d": analyticsSummarySchema,
										"30d": analyticsSummarySchema,
									},
									required: ["today", "7d", "30d"],
								},
							},
							required: ["profilePageId", "state", "summaries", "timezone"],
						},
						{
							type: "object",
							properties: {
								profilePageId: { type: "null" },
								state: { type: "string", enum: ["disabled"] },
								timezone: { type: "string" },
								summaries: {
									type: "object",
									properties: {
										today: analyticsSummarySchema,
										"7d": analyticsSummarySchema,
										"30d": analyticsSummarySchema,
									},
									required: ["today", "7d", "30d"],
								},
							},
							required: ["profilePageId", "state", "summaries", "timezone"],
						},
					],
				},
				examples: {
					ready: {
						summary: "Analytics ready",
						value: {
							profilePageId: "page_123",
							state: "ready",
							timezone: "Asia/Seoul",
							summaries: {
								today: analyticsTodayExample,
								"7d": analytics7dExample,
								"30d": analytics30dExample,
							},
						},
					},
					noProfile: {
						summary: "No owned profile page",
						value: {
							profilePageId: null,
							state: "no-profile",
							timezone: "Asia/Seoul",
							summaries: {
								today: analyticsTodayExample,
								"7d": analytics7dExample,
								"30d": analytics30dExample,
							},
						},
					},
					disabled: {
						summary: "Analytics disabled",
						value: {
							profilePageId: null,
							state: "disabled",
							timezone: "UTC",
							summaries: {
								today: analyticsTodayExample,
								"7d": analytics7dExample,
								"30d": analytics30dExample,
							},
						},
					},
				},
			},
		},
	},
	401: {
		description: "Authentication required.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string", enum: ["unauthorized"] },
								message: { type: "string" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
				examples: {
					unauthorized: {
						summary: "No session",
						value: {
							error: {
								code: "unauthorized",
								message: "authentication required",
							},
						},
					},
				},
			},
		},
	},
	500: {
		description: "Failed to load analytics.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string", enum: ["profile_analytics_failed"] },
								message: { type: "string" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
				examples: {
					failed: {
						summary: "Unexpected failure",
						value: {
							error: {
								code: "profile_analytics_failed",
								message: "failed to load profile analytics",
							},
						},
					},
				},
			},
		},
	},
};

delete meAnalyticsGet.responses.default;

const profileGet = openApi.paths?.["/profile/{handle}"]?.get as
	| {
			parameters?: unknown[];
			responses?: Record<string, unknown>;
			summary?: string;
			description?: string;
			tags?: string[];
			operationId?: string;
	  }
	| undefined;

if (!profileGet) {
	throw new Error(
		"Could not find /profile/{handle} GET operation in openapi.json",
	);
}

profileGet.summary = "Get a profile by handle";
profileGet.description =
	"Returns a profile page and its bento blocks for the provided handle. This endpoint is read-only and does not require authentication. If a session is present, the `viewer` object reflects whether the current user can edit the page.";
profileGet.operationId = "getProfileByHandle";
profileGet.tags = ["Profile API"];
profileGet.parameters = [
	{
		name: "handle",
		in: "path",
		required: true,
		description:
			"Profile handle from the URL path. The route forwards this value directly to the lookup layer.",
		schema: {
			type: "string",
		},
		example: "kinmongsang",
	},
];
profileGet.responses = {
	200: {
		description:
			"Successful profile response. `layout` is always present for every bento item. `viewer.canEdit` is true only for the authenticated owner of the page.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						page: {
							type: "object",
							properties: {
								id: { type: "string" },
								userId: { type: "string" },
								handle: { type: "string" },
								name: { type: "string", nullable: true },
								role: { type: "string", nullable: true },
								bio: { type: "string", nullable: true },
								image: { type: "string", nullable: true },
								backgroundImage: { type: "string", nullable: true },
								location: { type: "string", nullable: true },
								updatedAt: {
									type: "string",
									format: "date-time",
								},
							},
							required: [
								"id",
								"userId",
								"handle",
								"name",
								"role",
								"bio",
								"image",
								"backgroundImage",
								"location",
								"updatedAt",
							],
						},
						bento: {
							type: "array",
							items: {
								oneOf: [
									profileLinkBentoSchema(),
									profileTextBentoSchema(),
									profileSectionBentoSchema(),
									profileMediaBentoSchema(),
									profileMapBentoSchema(),
								],
							},
						},
						viewer: {
							type: "object",
							properties: {
								isAuthenticated: { type: "boolean" },
								userId: { type: "string", nullable: true },
								canEdit: { type: "boolean" },
							},
							required: ["isAuthenticated", "userId", "canEdit"],
						},
					},
					required: ["page", "bento", "viewer"],
				},
				examples: {
					default: {
						value: {
							page: {
								id: "profile_page_123",
								userId: "user_456",
								handle: "kinmongsang",
								name: "Kinmongsang",
								role: "Photographer",
								bio: "Photo community profile",
								image: "https://cdn.harune.me/avatar.jpg",
								backgroundImage: "https://cdn.harune.me/background.jpg",
								location: "Seoul, KR",
								updatedAt: "2026-05-07T00:00:00.000Z",
							},
							bento: [
								{
									id: "bento_link_1",
									type: "link",
									layout: {
										desktop: { x: 0, y: 0, w: 4, h: 2 },
										compact: { x: 0, y: 0, w: 2, h: 2 },
									},
									content: {
										title: "Portfolio",
										description: "Main portfolio site",
										favicon: "https://cdn.harune.me/favicon.ico",
										thumbnail: "https://cdn.harune.me/thumb.jpg",
										url: "https://example.com",
									},
								},
							],
							viewer: {
								isAuthenticated: true,
								userId: "user_456",
								canEdit: true,
							},
						},
					},
				},
			},
		},
	},
	404: {
		description: "No profile page exists for the requested handle.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string", example: "profile_not_found" },
								message: { type: "string", example: "profile not found" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
			},
		},
	},
	500: {
		description:
			"Internal profile data is inconsistent. This usually means a required layout or subtype row is missing.",
		content: {
			"application/json": {
				schema: {
					type: "object",
					properties: {
						error: {
							type: "object",
							properties: {
								code: { type: "string" },
								message: { type: "string" },
							},
							required: ["code", "message"],
						},
					},
					required: ["error"],
				},
			},
		},
	},
};

await writeFile(openApiPath, `${JSON.stringify(openApi, null, 2)}\n`);

function profileBaseLayoutSchema() {
	return {
		type: "object",
		properties: {
			x: { type: "number" },
			y: { type: "number" },
			w: { type: "number" },
			h: { type: "number" },
		},
		required: ["x", "y", "w", "h"],
	};
}

function profileLayoutSchema() {
	return {
		type: "object",
		properties: {
			desktop: profileBaseLayoutSchema(),
			compact: profileBaseLayoutSchema(),
		},
		required: ["desktop", "compact"],
	};
}

function profileLinkBentoSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["link"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				properties: {
					title: { type: "string" },
					description: { type: "string", nullable: true },
					favicon: { type: "string", nullable: true },
					thumbnail: { type: "string", nullable: true },
					url: { type: "string" },
				},
				required: ["title", "description", "favicon", "thumbnail", "url"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileTextBentoSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["text"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				properties: {
					content: { type: "string" },
				},
				required: ["content"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileSectionBentoSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["section"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				properties: {
					title: { type: "string" },
				},
				required: ["title"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileMediaBentoSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["media"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				properties: {
					mediaType: { type: "string", enum: ["image", "video"] },
					url: { type: "string" },
					objectKey: { type: "string" },
					href: { type: "string", nullable: true },
					alt: { type: "string" },
					caption: { type: "string" },
				},
				required: ["mediaType", "url", "objectKey", "href", "alt", "caption"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileMapBentoSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["map"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				properties: {
					latitude: { type: "number" },
					longitude: { type: "number" },
					zoom: { type: "number" },
					caption: { type: "string" },
					url: { type: "string" },
				},
				required: ["latitude", "longitude", "zoom", "caption", "url"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profilePageSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			userId: { type: "string" },
			handle: { type: "string" },
			name: { type: "string", nullable: true },
			role: { type: "string", nullable: true },
			bio: { type: "string", nullable: true },
			image: { type: "string", nullable: true },
			backgroundImage: { type: "string", nullable: true },
			location: { type: "string", nullable: true },
			updatedAt: { type: "string", format: "date-time" },
		},
		required: [
			"id",
			"userId",
			"handle",
			"name",
			"role",
			"bio",
			"image",
			"backgroundImage",
			"location",
			"updatedAt",
		],
	};
}

function profilePageRecordSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			userId: { type: "string" },
			handle: { type: "string" },
			name: { type: "string", nullable: true },
			location: { type: "string", nullable: true },
			role: { type: "string", nullable: true },
			bio: { type: "string", nullable: true },
			image: { type: "string", nullable: true },
			backgroundImage: { type: "string", nullable: true },
			createdAt: { type: "string", format: "date-time" },
			updatedAt: { type: "string", format: "date-time" },
		},
		required: [
			"id",
			"userId",
			"handle",
			"name",
			"location",
			"role",
			"bio",
			"image",
			"backgroundImage",
			"createdAt",
			"updatedAt",
		],
	};
}

function profileResponseSchema() {
	return {
		type: "object",
		properties: {
			page: profilePageSchema(),
			bento: {
				type: "array",
				items: {
					oneOf: [
						profileLinkBentoSchema(),
						profileTextBentoSchema(),
						profileSectionBentoSchema(),
						profileMediaBentoSchema(),
						profileMapBentoSchema(),
					],
				},
			},
			viewer: {
				type: "object",
				properties: {
					isAuthenticated: { type: "boolean" },
					userId: { type: "string", nullable: true },
					canEdit: { type: "boolean" },
				},
				required: ["isAuthenticated", "userId", "canEdit"],
			},
		},
		required: ["page", "bento", "viewer"],
	};
}

function profilePagesResponseSchema() {
	return {
		type: "object",
		properties: {
			pages: {
				type: "array",
				items: profilePageRecordSchema(),
			},
		},
		required: ["pages"],
	};
}

function profilePageUpdateRequestSchema() {
	return {
		type: "object",
		additionalProperties: false,
		properties: {
			handle: { type: "string" },
			name: { type: "string", nullable: true },
			location: { type: "string", nullable: true },
			role: { type: "string", nullable: true },
			bio: { type: "string", nullable: true },
			image: { type: "string", nullable: true },
			backgroundImage: { type: "string", nullable: true },
			bento: profileBentoReplaceRequestSchema().properties?.bento,
		},
	};
}

function profileLinkBentoMutationSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["link"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					title: { type: "string" },
					description: { type: "string", nullable: true },
					favicon: { type: "string", nullable: true },
					thumbnail: { type: "string", nullable: true },
					url: { type: "string" },
				},
				required: ["title", "url"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileTextBentoMutationSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["text"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					content: { type: "string" },
				},
				required: ["content"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileSectionBentoMutationSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["section"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					title: { type: "string" },
				},
				required: ["title"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileMediaBentoMutationSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["media"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					mediaType: { type: "string", enum: ["image", "video"] },
					url: { type: "string" },
					objectKey: { type: "string" },
					tempObjectKey: { type: "string", nullable: true },
					contentHash: { type: "string", nullable: true },
					contentType: { type: "string", nullable: true },
					href: { type: "string", nullable: true },
					alt: { type: "string" },
					caption: { type: "string" },
				},
				required: ["mediaType", "url", "objectKey", "alt", "caption"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileMapBentoMutationSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["map"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					latitude: { type: "number" },
					longitude: { type: "number" },
					zoom: { type: "number" },
					caption: { type: "string" },
					url: { type: "string" },
				},
				required: ["latitude", "longitude", "zoom", "url"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileBentoReplaceRequestSchema() {
	return {
		type: "object",
		additionalProperties: false,
		properties: {
			bento: {
				type: "array",
				items: {
					oneOf: [
						profileLinkBentoMutationSchema(),
						profileTextBentoMutationSchema(),
						profileSectionBentoMutationSchema(),
						profileMediaBentoMutationSchema(),
						profileMapBentoMutationSchema(),
					],
				},
			},
		},
		required: ["bento"],
	};
}

function profileErrorSchema(codes: string[]) {
	return {
		type: "object",
		properties: {
			error: {
				type: "object",
				additionalProperties: false,
				properties: {
					code: { type: "string", enum: codes },
					message: { type: "string" },
					details: { type: "object", additionalProperties: true },
				},
				required: ["code", "message"],
			},
		},
		required: ["error"],
	};
}

function profileImageUploadSuccessSchema() {
	return {
		type: "object",
		properties: {
			imageKind: { type: "string", enum: ["profile", "background"] },
			imageHash: { type: "string" },
			imageUrl: { type: "string" },
			objectKey: { type: "string" },
			contentType: { type: "string" },
			contentLength: { type: "number" },
			uploadUrl: { type: "string" },
			expiresAt: { type: "string", format: "date-time" },
		},
		required: [
			"imageKind",
			"imageHash",
			"imageUrl",
			"objectKey",
			"contentType",
			"contentLength",
			"uploadUrl",
			"expiresAt",
		],
	};
}

function profileImageFinalizeSuccessSchema() {
	return {
		type: "object",
		properties: {
			imageKind: { type: "string", enum: ["profile", "background"] },
			imageUrl: { type: "string" },
			image: { type: "string", nullable: true },
			backgroundImage: { type: "string", nullable: true },
			updatedAt: { type: "string", format: "date-time" },
		},
		required: [
			"imageKind",
			"imageUrl",
			"image",
			"backgroundImage",
			"updatedAt",
		],
	};
}

function profileImageDeleteSuccessSchema() {
	return {
		type: "object",
		properties: {
			success: { type: "boolean" },
			deletedObjectKey: { type: "string" },
		},
		required: ["success", "deletedObjectKey"],
	};
}

function profileBentoMediaUploadSuccessSchema() {
	return {
		type: "object",
		properties: {
			bentoId: { type: "string" },
			contentHash: { type: "string" },
			contentType: { type: "string" },
			mediaType: { type: "string", enum: ["image", "video"] },
			tempObjectKey: { type: "string" },
			tempUrl: { type: "string" },
			uploadUrl: { type: "string" },
			expiresAt: { type: "string", format: "date-time" },
			contentLength: { type: "number" },
		},
		required: [
			"bentoId",
			"contentHash",
			"contentType",
			"mediaType",
			"tempObjectKey",
			"tempUrl",
			"uploadUrl",
			"expiresAt",
			"contentLength",
		],
	};
}

const profilePagesGet = openApi.paths?.["/profile/pages"]?.get as
	| {
			responses?: Record<string, unknown>;
			summary?: string;
			description?: string;
			tags?: string[];
			operationId?: string;
	  }
	| undefined;

if (!profilePagesGet) {
	throw new Error(
		"Could not find /profile/pages GET operation in openapi.json",
	);
}

profilePagesGet.summary = "List profile page rows";
profilePagesGet.description =
	"Returns every row from the profile_page table. The endpoint does not require authentication, returns rows in updatedAt descending order then createdAt descending order, serializes timestamps as ISO strings, and returns no-store headers on success.";
profilePagesGet.operationId = "listProfilePages";
profilePagesGet.tags = ["Profile API"];
profilePagesGet.responses = {
	200: {
		description:
			"Successful profile page list. Every row from profile_page is returned with all stored columns.",
		content: {
			"application/json": {
				schema: profilePagesResponseSchema(),
				examples: {
					default: {
						value: {
							pages: [
								{
									id: "page_123",
									userId: "user_123",
									handle: "harune",
									name: "Harune",
									location: "Seoul",
									role: "creator",
									bio: "Link in bio page",
									image: "https://cdn.harune.me/avatar.png",
									backgroundImage: null,
									createdAt: "2026-05-07T00:00:00.000Z",
									updatedAt: "2026-05-08T01:00:00.000Z",
								},
							],
						},
					},
				},
			},
		},
	},
	500: {
		description: "Internal profile page list failure.",
		content: {
			"application/json": {
				schema: profileErrorSchema(["profile_pages_failed"]),
				examples: {
					failed: {
						value: {
							error: {
								code: "profile_pages_failed",
								message: "failed to load profile pages",
							},
						},
					},
				},
			},
		},
	},
};
delete profilePagesGet.responses.default;

const profileImagePost = openApi.paths?.["/profile/image"]?.post as
	| {
			requestBody?: unknown;
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!profileImagePost) {
	throw new Error(
		"Could not find /profile/image POST operation in openapi.json",
	);
}

profileImagePost.operationId = "uploadProfileImage";
profileImagePost.requestBody = {
	required: true,
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					imageKind: { type: "string", enum: ["profile", "background"] },
					contentType: { type: "string" },
					contentLength: { type: "number" },
					imageHash: { type: "string" },
				},
				required: ["imageKind", "contentType", "contentLength", "imageHash"],
			},
			examples: {
				default: {
					value: {
						imageKind: "profile",
						contentType: "image/png",
						contentLength: 12345,
						imageHash:
							"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
					},
				},
			},
		},
	},
};
profileImagePost.responses ??= {};
profileImagePost.responses["200"] = {
	description:
		"Successful profile image presign response. The server returns the stable object URL, the presigned PUT URL, and the metadata required for later finalize.",
	content: {
		"application/json": {
			schema: profileImageUploadSuccessSchema(),
			examples: {
				default: {
					value: {
						imageKind: "profile",
						imageHash:
							"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
						imageUrl:
							"https://pub.example.com/public/users/user-1/profile?v=abc123",
						objectKey: "public/users/user-1/profile",
						contentType: "image/png",
						contentLength: 12345,
						uploadUrl:
							"https://upload.example/public%2Fusers%2Fuser-1%2Fprofile%2Fprofile?contentType=image%2Fpng",
						expiresAt: "2026-05-08T02:00:00.000Z",
					},
				},
			},
		},
	},
};
profileImagePost.responses["400"] = {
	description:
		"Invalid upload request. Returned when the JSON body is malformed, the image kind is invalid, the content type is unsupported, the content length is too large, or the hash is malformed.",
	content: {
		"application/json": {
			schema: profileErrorSchema([
				"validation_error",
				"profile_image_invalid_type",
				"profile_image_too_large",
			]),
			examples: {
				validation: {
					value: {
						error: {
							code: "validation_error",
							message: "invalid request",
						},
					},
				},
			},
		},
	},
};
profileImagePost.responses["401"] = {
	description: "Authentication required.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["unauthorized"]),
			examples: {
				default: {
					value: {
						error: {
							code: "unauthorized",
							message: "authentication required",
						},
					},
				},
			},
		},
	},
};
profileImagePost.responses["500"] = {
	description:
		"Internal profile image presign failure. Returned when R2 upload credentials or the public base URL are missing, invalid, or when presign generation fails for another unexpected reason.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_image_upload_failed"]),
		},
	},
};
delete profileImagePost.responses.default;

const profileImagePatch = openApi.paths?.["/profile/image"]?.patch as
	| {
			requestBody?: unknown;
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!profileImagePatch) {
	throw new Error(
		"Could not find /profile/image PATCH operation in openapi.json",
	);
}

profileImagePatch.operationId = "finalizeProfileImage";
profileImagePatch.requestBody = {
	required: true,
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					imageKind: { type: "string", enum: ["profile", "background"] },
					imageUrl: { type: "string" },
				},
				required: ["imageKind", "imageUrl"],
			},
			examples: {
				default: {
					value: {
						imageKind: "profile",
						imageUrl:
							"https://pub.example.com/public/users/user-1/profile?v=abc123",
					},
				},
			},
		},
	},
};
profileImagePatch.responses ??= {};
profileImagePatch.responses["200"] = {
	description: "Successful profile image finalize response.",
	content: {
		"application/json": {
			schema: profileImageFinalizeSuccessSchema(),
			examples: {
				default: {
					value: {
						imageKind: "profile",
						imageUrl:
							"https://pub.example.com/public/users/user-1/profile?v=abc123",
						image:
							"https://pub.example.com/public/users/user-1/profile?v=abc123",
						backgroundImage: null,
						updatedAt: "2026-05-08T01:00:00.000Z",
					},
				},
			},
		},
	},
};
profileImagePatch.responses["400"] = {
	description: "Invalid finalize request.",
	content: {
		"application/json": {
			schema: profileErrorSchema([
				"validation_error",
				"profile_image_url_invalid",
			]),
		},
	},
};
profileImagePatch.responses["401"] = {
	description: "Authentication required.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["unauthorized"]),
		},
	},
};
profileImagePatch.responses["403"] = {
	description: "The target imageUrl does not belong to the authenticated user.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_image_forbidden"]),
		},
	},
};
profileImagePatch.responses["404"] = {
	description: "The profile page or image object does not exist.",
	content: {
		"application/json": {
			schema: profileErrorSchema([
				"profile_page_not_found",
				"profile_image_not_found",
			]),
		},
	},
};
profileImagePatch.responses["500"] = {
	description: "Internal profile image finalize failure.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_image_finalize_failed"]),
		},
	},
};
delete profileImagePatch.responses.default;

const profileImageDelete = openApi.paths?.["/profile/image"]?.delete as
	| {
			requestBody?: unknown;
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!profileImageDelete) {
	throw new Error(
		"Could not find /profile/image DELETE operation in openapi.json",
	);
}

profileImageDelete.operationId = "deleteProfileImage";
profileImageDelete.requestBody = {
	required: true,
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					imageUrl: { type: "string" },
				},
				required: ["imageUrl"],
			},
			examples: {
				default: {
					value: {
						imageUrl:
							"https://pub.example.com/public/users/user-1/profile?v=abc123",
					},
				},
			},
		},
	},
};
profileImageDelete.responses ??= {};
profileImageDelete.responses["200"] = {
	description: "Successful profile image deletion.",
	content: {
		"application/json": {
			schema: profileImageDeleteSuccessSchema(),
			examples: {
				default: {
					value: {
						success: true,
						deletedObjectKey: "public/users/user-1/profile",
					},
				},
			},
		},
	},
};
profileImageDelete.responses["400"] = {
	description: "Invalid delete request.",
	content: {
		"application/json": {
			schema: profileErrorSchema([
				"validation_error",
				"profile_image_url_invalid",
			]),
		},
	},
};
profileImageDelete.responses["401"] = {
	description: "Authentication required.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["unauthorized"]),
		},
	},
};
profileImageDelete.responses["403"] = {
	description: "The target imageUrl does not belong to the authenticated user.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_image_forbidden"]),
		},
	},
};
profileImageDelete.responses["404"] = {
	description: "The profile image object does not exist.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_image_not_found"]),
		},
	},
};
profileImageDelete.responses["500"] = {
	description: "Internal profile image delete failure.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_image_delete_failed"]),
		},
	},
};
delete profileImageDelete.responses.default;

const profileBentoMediaUpload = openApi.paths?.["/profile/bento/media/upload"]
	?.post as
	| {
			requestBody?: unknown;
			responses?: Record<string, unknown>;
			operationId?: string;
	  }
	| undefined;

if (!profileBentoMediaUpload) {
	throw new Error(
		"Could not find /profile/bento/media/upload POST operation in openapi.json",
	);
}

profileBentoMediaUpload.operationId = "uploadProfileBentoMedia";
profileBentoMediaUpload.requestBody = {
	required: true,
	content: {
		"application/json": {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					bentoId: { type: "string" },
					contentType: { type: "string" },
					contentLength: { type: "number" },
					contentHash: { type: "string" },
				},
				required: ["bentoId", "contentType", "contentLength", "contentHash"],
			},
			examples: {
				default: {
					value: {
						bentoId: "bento_123",
						contentType: "video/mp4",
						contentLength: 23456,
						contentHash:
							"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
					},
				},
			},
		},
	},
};
profileBentoMediaUpload.responses ??= {};
profileBentoMediaUpload.responses["200"] = {
	description:
		"Successful bento media presign response for either a persisted bento owned by the authenticated user or a client-generated `preview:` draft id. Persisted bento uploads return a legacy temporary object key. `preview:` uploads return a public preview object key so the later save can avoid a temp-to-final copy.",
	content: {
		"application/json": {
			schema: profileBentoMediaUploadSuccessSchema(),
			examples: {
				default: {
					value: {
						bentoId: "bento_123",
						contentHash:
							"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
						contentType: "video/mp4",
						mediaType: "video",
						tempObjectKey:
							"public/users/user-1/bento/preview:123e4567-e89b-12d3-a456-426614174000",
						tempUrl:
							"https://pub.example.com/public/users/user-1/bento/preview:123e4567-e89b-12d3-a456-426614174000?v=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
						uploadUrl:
							"https://upload.example/public%2Fusers%2Fuser-1%2Fbento%2Fbento_123?contentType=video%2Fmp4",
						expiresAt: "2026-05-08T02:00:00.000Z",
						contentLength: 23456,
					},
				},
			},
		},
	},
};
profileBentoMediaUpload.responses["400"] = {
	description:
		"Invalid bento upload request. Returned when the JSON body is missing, the bentoId is empty, the content type is unsupported, or the content length exceeds 5MB.",
	content: {
		"application/json": {
			schema: profileErrorSchema([
				"validation_error",
				"profile_media_invalid_type",
				"profile_media_too_large",
			]),
		},
	},
};
profileBentoMediaUpload.responses["401"] = {
	description: "Authentication required.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["unauthorized"]),
		},
	},
};
profileBentoMediaUpload.responses["403"] = {
	description:
		"The target bento does not belong to the authenticated user. This still applies to persisted bento ids that are not owned by the current session.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_bento_forbidden"]),
		},
	},
};
profileBentoMediaUpload.responses["500"] = {
	description:
		"Internal bento media presign failure. Returned when R2 upload credentials or the public base URL are missing, invalid, or when presign generation fails for another unexpected reason.",
	content: {
		"application/json": {
			schema: profileErrorSchema(["profile_media_upload_failed"]),
		},
	},
};
delete profileBentoMediaUpload.responses.default;

const profileMePut = openApi.paths?.["/profile/me"]?.put as
	| {
			requestBody?: unknown;
			responses?: Record<string, unknown>;
			summary?: string;
			description?: string;
			tags?: string[];
			operationId?: string;
	  }
	| undefined;

if (!profileMePut) {
	throw new Error("Could not find /profile/me PUT operation in openapi.json");
}

profileMePut.summary = "Update my profile page";
profileMePut.description =
	"Partially updates the authenticated user's profile page. The server trims text fields, allows null to clear fields, treats empty `role` and `location` strings as null, validates image/backgroundImage as absolute http or https URLs when provided, and can also accept a full `bento` snapshot in the same request so profile fields and bento graph commit together with no-store headers on success. When the authenticated user does not yet have a profile page, the same endpoint accepts the onboarding create payload with `handle` and `name` and creates the page before returning the committed profile snapshot.";
profileMePut.operationId = "updateProfilePage";
profileMePut.tags = ["Profile API"];
profileMePut.requestBody = {
	required: true,
	content: {
		"application/json": {
			schema: profilePageUpdateRequestSchema(),
			examples: {
				createIfMissing: {
					summary: "Create the initial page during onboarding",
					value: {
						handle: "maker_one",
						name: "Maker One",
						bio: "Bio",
						role: "Creator",
						location: "Seoul",
						image: "https://cdn.harune.me/avatar.png",
					},
				},
				updateNameBio: {
					summary: "Update name and bio only",
					value: {
						name: "Updated Maker",
						bio: "Updated bio",
					},
				},
				clearImages: {
					summary: "Clear hero images",
					value: {
						image: null,
						backgroundImage: null,
					},
				},
				saveProfileAndBento: {
					summary: "Save profile and bento together",
					value: {
						name: "Harune",
						image:
							"https://cdn.harune.me/public/users/user_123/profile/profile?v=image-hash-123",
						bento: [
							{
								id: "bento_123",
								type: "media",
								layout: {
									desktop: { x: 0, y: 0, w: 4, h: 4 },
									compact: { x: 0, y: 0, w: 4, h: 4 },
								},
								content: {
									mediaType: "image",
									url: "https://cdn.harune.me/public/users/user_123/bento/bento_123?v=content-hash-123",
									objectKey: "public/users/user_123/bento/bento_123",
									tempObjectKey:
										"tmp/users/user_123/bento/bento_123/123e4567-e89b-12d3-a456-426614174000",
									contentHash: "content-hash-123",
									contentType: "image/png",
									alt: "Alt",
									caption: "Caption",
								},
							},
						],
					},
				},
				blankOptionalFields: {
					summary: "Clear optional text fields with blanks",
					value: {
						role: "   ",
						location: "   ",
					},
				},
			},
		},
	},
};
profileMePut.responses = {
	200: {
		description:
			"Successful profile update. Returns the committed profile snapshot, including bento when a bento snapshot was included in the same request.",
		content: {
			"application/json": {
				schema: profileResponseSchema(),
				examples: {
					default: {
						value: {
							page: {
								id: "page_123",
								userId: "user_123",
								handle: "harune",
								name: "Harune",
								role: "creator",
								bio: "Link in bio page",
								image: "https://cdn.harune.me/avatar.png",
								backgroundImage: null,
								location: "Seoul",
								updatedAt: "2026-05-08T01:00:00.000Z",
							},
							bento: [],
							viewer: {
								isAuthenticated: true,
								userId: "user_123",
								canEdit: true,
							},
						},
					},
				},
			},
		},
	},
	400: {
		description:
			"Invalid profile update request. Returned when the payload is malformed, contains unknown fields, includes invalid text or URL values, or fails bento validation when a bento snapshot is included.",
		content: {
			"application/json": {
				schema: profileErrorSchema(["validation_error"]),
				examples: {
					validation: {
						value: {
							error: {
								code: "validation_error",
								message: "invalid request",
							},
						},
					},
				},
			},
		},
	},
	401: {
		description: "Authentication required.",
		content: {
			"application/json": {
				schema: profileErrorSchema(["unauthorized"]),
				examples: {
					unauthorized: {
						value: {
							error: {
								code: "unauthorized",
								message: "authentication required",
							},
						},
					},
				},
			},
		},
	},
	404: {
		description: "The current user does not own a profile page.",
		content: {
			"application/json": {
				schema: profileErrorSchema(["profile_page_not_found"]),
				examples: {
					notFound: {
						value: {
							error: {
								code: "profile_page_not_found",
								message: "profile page not found",
							},
						},
					},
				},
			},
		},
	},
	500: {
		description: "Failed to load the committed profile snapshot after update.",
		content: {
			"application/json": {
				schema: profileErrorSchema(["profile_page_update_failed"]),
				examples: {
					failed: {
						value: {
							error: {
								code: "profile_page_update_failed",
								message: "failed to update profile page",
							},
						},
					},
				},
			},
		},
	},
};
delete profileMePut.responses.default;
await writeFile(openApiPath, `${JSON.stringify(openApi, null, 2)}\n`);
