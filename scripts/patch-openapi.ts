import { readFile, writeFile } from "node:fs/promises";

const openApiPath = "./src/generated/openapi.json";

type OpenApiDocument = {
	paths?: Record<string, Record<string, unknown>>;
};

const raw = await readFile(openApiPath, "utf8");
const openApi = JSON.parse(raw) as OpenApiDocument;

function profileImageCropSchema() {
	return {
		type: "object",
		properties: {
			croppedAreaPixels: {
				type: "object",
				properties: {
					x: { type: "number" },
					y: { type: "number" },
					width: { type: "number" },
					height: { type: "number" },
				},
				required: ["x", "y", "width", "height"],
			},
		},
		required: ["croppedAreaPixels"],
	};
}

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
					domain: { type: "string" },
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
						required: ["provider", "viewType", "fetchedAt", "payload"],
					},
				},
				required: [
					"url",
					"domain",
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
						domain: "example.com",
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
					summary: "GitHub profile with 60-day contribution calendar",
					value: {
						url: "https://github.com/octocat",
						domain: "github.com",
						title: "The Octocat",
						description: null,
						image: "https://avatars.githubusercontent.com/u/583231?v=4",
						siteName: "GitHub",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/github.svg",
						provider: "github",
						providerMetadata: {
							provider: "github",
							viewType: "github_contributions_60d",
							fetchedAt: "2026-05-12T00:00:00.000Z",
							payload: {
								login: "octocat",
								name: "The Octocat",
								avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
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
				twitchChannel: {
					summary: "Twitch channel with follower count",
					value: {
						url: "https://www.twitch.tv/twitchdev",
						domain: "twitch.tv",
						title: "TwitchDev",
						description: "Followers 1,234,567",
						image:
							"https://static-cdn.jtvnw.net/jtv_user_pictures/profile_image.png",
						siteName: "Twitch",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/twitch.svg",
						provider: "twitch",
						providerMetadata: {
							provider: "twitch",
							viewType: "twitch_channel",
							fetchedAt: "2026-05-19T00:00:00.000Z",
							payload: {
								broadcasterId: "141981764",
								broadcasterLogin: "twitchdev",
								broadcasterName: "TwitchDev",
								displayName: "TwitchDev",
								description: "Supporting third-party developers.",
								profileImageUrl:
									"https://static-cdn.jtvnw.net/jtv_user_pictures/profile_image.png",
								offlineImageUrl:
									"https://static-cdn.jtvnw.net/jtv_user_pictures/offline_image.png",
								followerCount: 1234567,
								viewCount: 5980557,
							},
						},
					},
				},
				discordInvite: {
					summary: "Discord invite metadata with approximate member count",
					value: {
						url: "https://discord.gg/abc123",
						domain: "discord.gg",
						title: "Harune Community",
						description: "Members 12,345",
						image:
							"https://cdn.discordapp.com/icons/123456789012345678/guild_icon.png?size=256",
						siteName: "Discord",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/discord.svg",
						provider: "discord",
						providerMetadata: {
							provider: "discord",
							viewType: "discord_invite",
							fetchedAt: "2026-05-19T00:00:00.000Z",
							payload: {
								code: "abc123",
								guildId: "123456789012345678",
								guildName: "Harune Community",
								guildDescription: "A friendly place",
								iconUrl:
									"https://cdn.discordapp.com/icons/123456789012345678/guild_icon.png?size=256",
								memberCount: 12345,
								presenceCount: 321,
							},
						},
					},
				},
				youtubeChannel: {
					summary: "YouTube channel metadata from channels.list",
					value: {
						url: "https://www.youtube.com/@youtubecreators",
						domain: "youtube.com",
						title: "YouTube Creators",
						description: "Official channel for creators",
						image: "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg",
						siteName: "YouTube",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/youtube.svg",
						provider: "youtube",
						providerMetadata: {
							provider: "youtube",
							viewType: "youtube_channel",
							fetchedAt: "2026-05-12T00:00:00.000Z",
							payload: {
								snippet: {
									title: "YouTube Creators",
									description: "Official channel for creators",
								},
								statistics: {
									viewCount: 123456,
									subscriberCount: 7890,
									hiddenSubscriberCount: false,
									videoCount: 42,
								},
							},
						},
					},
				},
				youtubeVideo: {
					summary: "YouTube video metadata from videos.list",
					value: {
						url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
						domain: "youtube.com",
						title: "Never Gonna Give You Up",
						description: "Music video",
						image: "https://i.ytimg.com/high.jpg",
						siteName: "YouTube",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/youtube.svg",
						provider: "youtube",
						providerMetadata: {
							provider: "youtube",
							viewType: "youtube_video",
							fetchedAt: "2026-05-12T00:00:00.000Z",
							payload: {
								videoId: "dQw4w9WgXcQ",
								channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
								channelTitle: "Rick Astley",
								snippet: {
									title: "Never Gonna Give You Up",
									description: "Music video",
								},
								statistics: {
									viewCount: 123456789,
									likeCount: 9876543,
									commentCount: 12345,
								},
								player: {
									embedHtml:
										'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
									embedWidth: 640,
									embedHeight: 360,
								},
							},
						},
					},
				},
				spotifyOembed: {
					summary: "Spotify page metadata from oEmbed",
					value: {
						url: "https://open.spotify.com/track/123",
						domain: "open.spotify.com",
						title: "My Path to Spotify: Women in Engineering",
						description: null,
						image:
							"https://i.scdn.co/image/ab67656300005f1ff8141e891abf749375772343",
						siteName: "Spotify",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/spotify.svg",
						provider: "spotify",
						providerMetadata: {
							provider: "spotify",
							viewType: "spotify_oembed",
							fetchedAt: "2026-05-19T00:00:00.000Z",
							payload: {
								title: "My Path to Spotify: Women in Engineering",
								html: '<iframe src="https://open.spotify.com/embed/track/123"></iframe>',
								width: 456,
								height: 152,
								version: "1.0",
								providerName: "Spotify",
								providerUrl: "https://spotify.com",
								type: "rich",
								thumbnailUrl:
									"https://i.scdn.co/image/ab67656300005f1ff8141e891abf749375772343",
								thumbnailWidth: 300,
								thumbnailHeight: 300,
							},
						},
					},
				},
				chzzkChannel: {
					summary: "CHZZK channel metadata from channels",
					value: {
						url: "https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f",
						domain: "chzzk.naver.com",
						title: "아야츠노 유니",
						description: "Followers 123,456",
						image: "https://nng-phinf.pstatic.net/profile.jpg",
						siteName: "CHZZK",
						favicon:
							"https://cdn.harune.me/public/assets/link-provider-icon/chzzk.svg",
						provider: "chzzk",
						providerMetadata: {
							provider: "chzzk",
							viewType: "chzzk_channel",
							fetchedAt: "2026-05-19T00:00:00.000Z",
							payload: {
								channelId: "45e71a76e949e16a34764deb962f9d9f",
								channelName: "아야츠노 유니",
								channelImageUrl: "https://nng-phinf.pstatic.net/profile.jpg",
								followerCount: 123456,
								verifiedMark: true,
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
							imageCrop: { ...profileImageCropSchema(), nullable: true },
						},
						required: ["id", "handle", "name", "image", "imageCrop"],
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
							imageCrop: null,
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
							imageCrop: null,
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
								imageCrop: { ...profileImageCropSchema(), nullable: true },
							},
							required: ["id", "handle", "name", "image", "imageCrop"],
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
								imageCrop: null,
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

const analyticsTodayVisitorsSchema = {
	type: "object",
	properties: {
		visitors: { type: "number" },
	},
	required: ["visitors"],
} as const;

const analyticsTodayVisitorsExample = {
	visitors: 17,
} as const;

meAnalyticsGet.summary = "Get today's visitors for the current user";
meAnalyticsGet.description =
	"Returns today's unique visitors for the authenticated owner's current profile page. The server normalizes timezone input, reads ownership from the authenticated session, and returns no-store headers on success. If the user has no profile page or analytics is disabled, the response still returns `0` visitors.";
meAnalyticsGet.operationId = "getMeAnalytics";
meAnalyticsGet.tags = ["Me API"];
meAnalyticsGet.responses = {
	200: {
		description: "Today's unique visitors for the current user.",
		content: {
			"application/json": {
				schema: analyticsTodayVisitorsSchema,
				examples: {
					today: {
						summary: "Today's visitors",
						value: analyticsTodayVisitorsExample,
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
	"Returns a profile page and its bento blocks for the provided handle. This endpoint is read-only and does not require authentication. Text bentos always resolve `content.url` and a style object, defaulting `url` to `null`, backgroundColor to `#ffffff`, textAlign to `start`, and verticalAlign to `start` when the stored row omits fields. Clock bentos always resolve `timezone`, `showDate`, `showSeconds`, and `style.backgroundColor` from the stored row, defaulting timezone to `Asia/Seoul`, both booleans to `true`, and backgroundColor to `#ffffff` when the stored row omits those fields. If a session is present, the `viewer` object reflects whether the current user can edit the page.";
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
			"Successful profile response. `layout` is always present for every bento item. Text bentos always include `content.url` and a resolved style object with backgroundColor, textAlign, and verticalAlign. Clock bentos always include timezone, showDate, showSeconds, and style.backgroundColor. `viewer.canEdit` is true only for the authenticated owner of the page.",
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
								imageCrop: { ...profileImageCropSchema(), nullable: true },
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
								"imageCrop",
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
									profileClockBentoSchema(),
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
								imageCrop: null,
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
								{
									id: "bento_text_1",
									type: "text",
									layout: {
										desktop: { x: 0, y: 2, w: 4, h: 1 },
										compact: { x: 0, y: 2, w: 2, h: 1 },
									},
									content: {
										content: "About me",
										url: null,
										style: {
											backgroundColor: "#ffffff",
											textAlign: "start",
											verticalAlign: "start",
										},
									},
								},
								{
									id: "bento_clock_1",
									type: "clock",
									layout: {
										desktop: { x: 0, y: 3, w: 4, h: 1 },
										compact: { x: 0, y: 3, w: 2, h: 1 },
									},
									content: {
										timezone: "Asia/Seoul",
										showDate: true,
										showSeconds: true,
										style: {
											backgroundColor: "#ffffff",
										},
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
				additionalProperties: false,
				properties: {
					content: { type: "string" },
					url: { type: "string", nullable: true },
					style: profileTextBentoStyleSchema(true),
				},
				required: ["content", "url", "style"],
			},
		},
		required: ["id", "type", "layout", "content"],
	};
}

function profileTextBentoStyleSchema(required = false) {
	return {
		type: "object",
		additionalProperties: false,
		properties: {
			backgroundColor: {
				type: "string",
				description: "Background color applied to the text surface.",
			},
			textAlign: {
				type: "string",
				enum: ["start", "center", "end"],
				description:
					"Text alignment within the text surface. `start` maps to left alignment and `end` maps to right alignment.",
			},
			verticalAlign: {
				type: "string",
				enum: ["start", "center", "end"],
				description:
					"Vertical alignment within the text surface. `start` maps to top alignment and `end` maps to bottom alignment.",
			},
		},
		...(required
			? { required: ["backgroundColor", "textAlign", "verticalAlign"] }
			: {}),
	};
}

function profileBackgroundBentoStyleSchema(required = false) {
	return {
		type: "object",
		additionalProperties: false,
		properties: {
			backgroundColor: {
				type: "string",
				description: "Background color applied to the bento surface.",
			},
		},
		...(required ? { required: ["backgroundColor"] } : {}),
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

function profileClockBentoSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["clock"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					timezone: {
						type: "string",
						default: "Asia/Seoul",
					},
					showDate: {
						type: "boolean",
						default: true,
					},
					showSeconds: {
						type: "boolean",
						default: true,
					},
					style: profileBackgroundBentoStyleSchema(true),
				},
				required: ["timezone", "showDate", "showSeconds", "style"],
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
			imageCrop: { ...profileImageCropSchema(), nullable: true },
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
			"imageCrop",
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
			imageCrop: { ...profileImageCropSchema(), nullable: true },
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
			"imageCrop",
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
						profileClockBentoSchema(),
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
			imageCrop: { ...profileImageCropSchema(), nullable: true },
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
					url: { type: "string", nullable: true },
					style: profileTextBentoStyleSchema(),
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

function profileClockBentoMutationSchema() {
	return {
		type: "object",
		properties: {
			id: { type: "string" },
			type: { type: "string", enum: ["clock"] },
			layout: profileLayoutSchema(),
			content: {
				type: "object",
				additionalProperties: false,
				properties: {
					timezone: {
						type: "string",
						default: "Asia/Seoul",
					},
					showDate: {
						type: "boolean",
						default: true,
					},
					showSeconds: {
						type: "boolean",
						default: true,
					},
					style: profileBackgroundBentoStyleSchema(),
				},
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
						profileClockBentoMutationSchema(),
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
			imageCrop: { ...profileImageCropSchema(), nullable: true },
			backgroundImage: { type: "string", nullable: true },
			updatedAt: { type: "string", format: "date-time" },
		},
		required: [
			"imageKind",
			"imageUrl",
			"image",
			"imageCrop",
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
									imageCrop: null,
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
					imageCrop: { ...profileImageCropSchema(), nullable: true },
				},
				required: ["imageKind", "imageUrl"],
			},
			examples: {
				default: {
					value: {
						imageKind: "profile",
						imageUrl:
							"https://pub.example.com/public/users/user-1/profile?v=abc123",
						imageCrop: {
							croppedAreaPixels: {
								x: 12,
								y: 24,
								width: 360,
								height: 360,
							},
						},
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
						imageCrop: {
							croppedAreaPixels: {
								x: 12,
								y: 24,
								width: 360,
								height: 360,
							},
						},
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
	"Partially updates the authenticated user's profile page. The server trims text fields, allows null to clear fields, treats empty `bio`, `role`, and `location` strings as null, validates image/backgroundImage as absolute http or https URLs when provided, and can also accept a full `bento` snapshot in the same request so profile fields and bento graph commit together with no-store headers on success. Text bentos resolve `content.url` and style defaults when omitted, using `url: null`, backgroundColor `#ffffff`, textAlign `start`, and verticalAlign `start`. Clock bentos resolve `timezone`, `showDate`, `showSeconds`, and `style.backgroundColor` when omitted, defaulting timezone to `Asia/Seoul`, both booleans to `true`, and backgroundColor to `#ffffff`. When the authenticated user does not yet have a profile page, the same endpoint accepts the onboarding create payload with `handle` and `name` and creates the page before returning the committed profile snapshot.";
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
						role: null,
						location: null,
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
								type: "text",
								layout: {
									desktop: { x: 0, y: 0, w: 4, h: 2 },
									compact: { x: 0, y: 0, w: 2, h: 2 },
								},
								content: {
									content: "Styled note",
									url: "https://example.com",
									style: {
										backgroundColor: "#ffffff",
										textAlign: "start",
										verticalAlign: "start",
									},
								},
							},
							{
								id: "bento_124",
								type: "media",
								layout: {
									desktop: { x: 0, y: 0, w: 4, h: 4 },
									compact: { x: 0, y: 0, w: 4, h: 4 },
								},
								content: {
									mediaType: "image",
									url: "https://cdn.harune.me/public/users/user_123/bento/bento_124?v=content-hash-123",
									objectKey: "public/users/user_123/bento/bento_124",
									tempObjectKey:
										"tmp/users/user_123/bento/bento_124/123e4567-e89b-12d3-a456-426614174000",
									contentHash: "content-hash-123",
									contentType: "image/png",
									alt: "Alt",
									caption: "Caption",
								},
							},
							{
								id: "bento_125",
								type: "clock",
								layout: {
									desktop: { x: 0, y: 4, w: 4, h: 1 },
									compact: { x: 0, y: 4, w: 2, h: 1 },
								},
								content: {
									timezone: "Asia/Seoul",
									showDate: true,
									showSeconds: true,
									style: {
										backgroundColor: "#ffffff",
									},
								},
							},
						],
					},
				},
				blankOptionalFields: {
					summary: "Clear optional text fields with blanks",
					value: {
						bio: "   ",
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
