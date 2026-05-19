import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleHonoError } from "../../lib/error-utils";
import {
	buildPublicObjectUrl,
	type createR2PresignedPutUrl,
	getProfileBentoMediaPublicUrl,
	getProfileImageObjectKey,
	getProfileMediaObjectKey,
	sha256Hex,
} from "../../lib/profile-media";
import type { AppBindings } from "../../types/app-bindings";
import { createProfileRoute } from "../profile-route";

type SessionState = {
	userId: string;
} | null;

function createMockBucket() {
	const objects = new Map<string, { contentType: string; bytes: Uint8Array }>();

	const bucket = {
		put: vi.fn(
			async (
				key: string,
				body: Uint8Array,
				options?: { httpMetadata?: { contentType?: string } },
			) => {
				objects.set(key, {
					contentType: options?.httpMetadata?.contentType ?? "",
					bytes: body instanceof Uint8Array ? body : new Uint8Array(body),
				});
			},
		),
		list: vi.fn(async (options?: { prefix?: string; limit?: number }) => {
			const prefix = options?.prefix ?? "";
			const limit = options?.limit ?? Number.POSITIVE_INFINITY;
			const objectsList = Array.from(objects.keys())
				.filter((key) => key.startsWith(prefix))
				.slice(0, limit)
				.map((key) => ({ key }) as never);

			return {
				objects: objectsList,
			} as never;
		}),
		get: vi.fn(async (key: string) => {
			const object = objects.get(key);

			if (!object) {
				return null;
			}

			return {
				...object,
				arrayBuffer: async () => object.bytes.slice().buffer,
				// minimal shape for copy helper
				httpMetadata: {
					contentType: object.contentType,
				},
			} as never;
		}),
		head: vi.fn(async (key: string) =>
			objects.has(key) ? ({ key } as never) : null,
		),
		delete: vi.fn(async (key: string) => {
			objects.delete(key);
		}),
	} satisfies Partial<R2Bucket>;

	return { bucket: bucket as R2Bucket, objects };
}

function createTestApp({
	session,
	page,
	pages,
	findProfilePages,
	ownedBento,
	bucket: _bucket,
	createPresignedPutUrl = async ({
		objectKey,
		contentType,
	}: Parameters<typeof createR2PresignedPutUrl>[0]) => ({
		uploadUrl: `https://upload.example/${encodeURIComponent(objectKey)}?contentType=${encodeURIComponent(contentType)}`,
		expiresAt: "2026-05-08T02:00:00.000Z",
	}),
}: {
	session: SessionState;
	page?: {
		id: string;
		userId: string;
		handle: string;
		name: string | null;
		image: string | null;
		imageCrop: {
			croppedAreaPixels: {
				x: number;
				y: number;
				width: number;
				height: number;
			};
		} | null;
		backgroundImage: string | null;
		updatedAt: Date;
	} | null;
	pages?: Array<{
		id: string;
		userId: string;
		handle: string;
		name: string | null;
		location: string | null;
		role: string | null;
		bio: string | null;
		image: string | null;
		imageCrop: {
			croppedAreaPixels: {
				x: number;
				y: number;
				width: number;
				height: number;
			};
		} | null;
		backgroundImage: string | null;
		createdAt: Date;
		updatedAt: Date;
	}>;
	findProfilePages?: () => Promise<unknown>;
	ownedBento?: { id: string } | null;
	bucket: ReturnType<typeof createMockBucket>;
	createPresignedPutUrl?: typeof createR2PresignedPutUrl;
}) {
	let currentPage = page ?? {
		id: "page-1",
		userId: "user-1",
		handle: "maker",
		name: "Maker",
		image: null,
		imageCrop: null,
		backgroundImage: null,
		updatedAt: new Date("2026-05-08T00:00:00.000Z"),
	};

	const route = createProfileRoute({
		createPresignedPutUrl,
		findProfilePageByUserId: async (_db, userId) => {
			if (!currentPage || currentPage.userId !== userId) {
				return null;
			}

			return currentPage;
		},
		updateProfilePageImageByUserId: async (
			_db,
			userId,
			imageKind,
			imageUrl,
			imageCrop,
		) => {
			if (!currentPage || currentPage.userId !== userId) {
				return;
			}

			currentPage = {
				...currentPage,
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
				...(imageKind === "profile"
					? { image: imageUrl, imageCrop: imageCrop ?? null }
					: { backgroundImage: imageUrl }),
			};
		},
		findProfilePages: async () => {
			if (findProfilePages) {
				return findProfilePages();
			}

			return pages ?? [];
		},
		findOwnedProfileBentoById: async (_db, bentoId, userId) => {
			if (!ownedBento || userId !== "user-1" || bentoId !== ownedBento.id) {
				return null;
			}

			return ownedBento;
		},
	});

	const app = new Hono<AppBindings>();
	app.use("*", async (c, next) => {
		c.set("db", {} as never);
		c.set("session", session as never);
		await next();
	});
	app.onError(handleHonoError);
	app.route("/profile", route);

	const rawRequest = app.request.bind(app);
	app.request = ((input: RequestInfo | URL, init?: RequestInit, env?: never) =>
		rawRequest(input, init, {
			R2_ACCOUNT_ID: "test-account",
			R2_ACCESS_KEY_ID: "test-access-key",
			R2_SECRET_ACCESS_KEY: "test-secret-key",
			PROFILE_MEDIA_BUCKET_NAME: "umbrella",
			R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			...(env as never),
		} as never)) as typeof app.request;

	return {
		app,
		getCurrentPage: () => currentPage,
	};
}

function createEditorTestApp({
	session,
	page,
	getProfile,
	syncProfileBentoGraph,
	bucket,
	db = {} as never,
}: {
	session: SessionState;
	page?: {
		id: string;
		userId: string;
		handle: string;
		name: string | null;
		location: string | null;
		role: string | null;
		bio: string | null;
		image: string | null;
		imageCrop: {
			croppedAreaPixels: {
				x: number;
				y: number;
				width: number;
				height: number;
			};
		} | null;
		backgroundImage: string | null;
		updatedAt: Date;
	} | null;
	getProfile?: (
		db: never,
		handle: string,
		viewer: { userId: string | null },
	) => Promise<unknown>;
	findProfileBentoSnapshotsByPageId?: (
		db: never,
		pageId: string,
	) => Promise<unknown[]>;
	syncProfileBentoGraph?: (
		db: never,
		pageId: string,
		bentos: unknown[],
	) => Promise<void>;
	bucket: ReturnType<typeof createMockBucket>;
	db?: unknown;
}) {
	let currentPage = page ?? {
		id: "page-1",
		userId: "user-1",
		handle: "maker",
		name: "Maker",
		location: "Seoul",
		role: "creator",
		bio: "Bio",
		image: null,
		imageCrop: null,
		backgroundImage: null,
		updatedAt: new Date("2026-05-08T00:00:00.000Z"),
	};
	let lastPatch: unknown = null;
	let lastSyncedBentos: unknown[] | null = null;

	const route = createProfileRoute({
		findProfilePageByUserId: async (_db, userId) => {
			if (!currentPage || currentPage.userId !== userId) {
				return null;
			}

			return currentPage;
		},
		updateProfilePageByUserId: async (_db, userId, patch) => {
			lastPatch = patch;

			if (!currentPage || currentPage.userId !== userId) {
				return null;
			}

			currentPage = {
				...currentPage,
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
				...patch,
			};

			return currentPage;
		},
		syncProfileBentoGraph: async (_db, _pageId, bentos) => {
			lastSyncedBentos = bentos as never[];
			if (syncProfileBentoGraph) {
				await syncProfileBentoGraph(_db, _pageId, bentos);
			}
		},
		getProfile: async (_db, handle, viewer) => {
			if (getProfile) {
				return getProfile(_db, handle, viewer);
			}

			return {
				page: currentPage
					? {
							id: currentPage.id,
							userId: currentPage.userId,
							handle: currentPage.handle,
							name: currentPage.name,
							role: currentPage.role,
							bio: currentPage.bio,
							image: currentPage.image,
							backgroundImage: currentPage.backgroundImage,
							location: currentPage.location,
							updatedAt: currentPage.updatedAt.toISOString(),
						}
					: null,
				bento: [],
				viewer: {
					isAuthenticated: viewer.userId !== null,
					userId: viewer.userId,
					canEdit: viewer.userId === currentPage?.userId,
				},
			};
		},
	});

	const app = new Hono<AppBindings>();
	app.use("*", async (c, next) => {
		c.set("db", db as never);
		c.set("session", session as never);
		await next();
	});
	app.onError(handleHonoError);
	app.route("/profile", route);
	const rawRequest = app.request.bind(app);
	app.request = ((input: RequestInfo | URL, init?: RequestInit, env?: never) =>
		rawRequest(input, init, {
			R2_ACCOUNT_ID: "test-account",
			R2_ACCESS_KEY_ID: "test-access-key",
			R2_SECRET_ACCESS_KEY: "test-secret-key",
			PROFILE_MEDIA_BUCKET_NAME: "umbrella",
			R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			PROFILE_MEDIA_BUCKET: bucket.bucket,
			...(env as never),
		} as never)) as typeof app.request;

	return {
		app,
		getCurrentPage: () => currentPage,
		getLastPatch: () => lastPatch,
		getLastSyncedBentos: () => lastSyncedBentos,
		bucket,
	};
}

function createCreateTestApp({
	session,
	page,
	handlePage,
	userExists = true,
	getProfile,
	bucket,
}: {
	session: SessionState;
	page?: {
		id: string;
		userId: string;
		handle: string;
		name: string | null;
		location: string | null;
		role: string | null;
		bio: string | null;
		image: string | null;
		backgroundImage: string | null;
		updatedAt: Date;
	} | null;
	handlePage?: {
		userId: string;
		handle: string;
	} | null;
	userExists?: boolean;
	getProfile?: (
		db: never,
		handle: string,
		viewer: { userId: string | null },
	) => Promise<unknown>;
	bucket: ReturnType<typeof createMockBucket>;
}) {
	let currentPage = page ?? null;
	let lastCreatedInput: unknown = null;

	const route = createProfileRoute({
		findUserById: async (_db, userId) => {
			if (!userExists || userId !== "user-1") {
				return null;
			}

			return { id: userId };
		},
		findProfilePageByUserId: async (_db, userId) => {
			if (!currentPage || currentPage.userId !== userId) {
				return null;
			}

			return currentPage;
		},
		findProfilePageByHandle: async (_db, handle) => {
			if (currentPage?.handle === handle) {
				return {
					userId: currentPage.userId,
					handle: currentPage.handle,
				};
			}

			if (handlePage?.handle === handle) {
				return handlePage;
			}

			return null;
		},
		createProfilePage: async (_db, input) => {
			lastCreatedInput = input;

			currentPage = {
				id: "page-1",
				userId: input.userId,
				handle: input.handle,
				name: input.name,
				location: input.location ?? null,
				role: input.role ?? null,
				bio: input.bio ?? null,
				image: input.image ?? null,
				imageCrop: input.imageCrop ?? null,
				backgroundImage: null,
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
			};

			return currentPage;
		},
		getProfile: async (_db, handle, viewer) => {
			if (getProfile) {
				return getProfile(_db, handle, viewer);
			}

			return {
				page: currentPage
					? {
							id: currentPage.id,
							userId: currentPage.userId,
							handle: currentPage.handle,
							name: currentPage.name,
							role: currentPage.role,
							bio: currentPage.bio,
							image: currentPage.image,
							imageCrop: currentPage.imageCrop,
							backgroundImage: currentPage.backgroundImage,
							location: currentPage.location,
							updatedAt: currentPage.updatedAt.toISOString(),
						}
					: null,
				bento: [],
				viewer: {
					isAuthenticated: viewer.userId !== null,
					userId: viewer.userId,
					canEdit: viewer.userId === currentPage?.userId,
				},
			};
		},
	});

	const app = new Hono<AppBindings>();
	app.use("*", async (c, next) => {
		c.set("db", {} as never);
		c.set("session", session as never);
		await next();
	});
	app.onError(handleHonoError);
	app.route("/profile", route);

	return {
		app,
		getCurrentPage: () => currentPage,
		getLastCreatedInput: () => lastCreatedInput,
		bucket,
	};
}

async function createImageFixture() {
	const bytes = new TextEncoder().encode("profile image payload");
	return {
		file: new File([bytes], "avatar.png", { type: "image/png" }),
		hash: await sha256Hex(bytes),
	};
}

describe("GET /profile/:handle", () => {
	it("returns a no-store profile response", async () => {
		const bucket = createMockBucket();
		const row = {
			pageId: "page-1",
			pageUserId: "user-1",
			pageHandle: "maker",
			pageName: "Maker",
			pageRole: null,
			pageBio: null,
			pageImage: null,
			pageImageCrop: null,
			pageBackgroundImage: null,
			pageLocation: null,
			pageUpdatedAt: new Date("2026-05-08T00:00:00.000Z"),
			bentoId: null,
		};
		const chain = {
			leftJoin: () => chain,
			where: () => chain,
			orderBy: () => Promise.resolve([row]),
		};
		const db = {
			select: () => ({
				from: () => chain,
			}),
		};
		const { app } = createEditorTestApp({
			session: null,
			db,
			bucket,
		});

		const response = await app.request("/profile/maker");

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
	});

	it("returns a no-store 404 when the profile handle is missing", async () => {
		const bucket = createMockBucket();
		const chain = {
			leftJoin: () => chain,
			where: () => chain,
			orderBy: () => Promise.resolve([]),
		};
		const db = {
			select: () => ({
				from: () => chain,
			}),
		};
		const { app } = createEditorTestApp({
			session: null,
			db,
			bucket,
		});

		const response = await app.request("/profile/missing");

		expect(response.status).toBe(404);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
	});

	it("defaults missing clock child rows instead of failing the public profile read", async () => {
		const bucket = createMockBucket();
		const row = {
			pageId: "page-1",
			pageUserId: "user-1",
			pageHandle: "maker",
			pageName: "Maker",
			pageRole: null,
			pageBio: null,
			pageImage: null,
			pageImageCrop: null,
			pageBackgroundImage: null,
			pageLocation: null,
			pageUpdatedAt: new Date("2026-05-08T00:00:00.000Z"),
			bentoId: "clock-bento-1",
			bentoType: "clock",
			desktopLayoutId: "desktop-layout-1",
			desktopLayoutX: 1,
			desktopLayoutY: 2,
			desktopLayoutW: 3,
			desktopLayoutH: 4,
			compactLayoutId: "compact-layout-1",
			compactLayoutX: 5,
			compactLayoutY: 6,
			compactLayoutW: 7,
			compactLayoutH: 8,
			linkBentoId: null,
			linkTitle: null,
			linkDescription: null,
			linkFavicon: null,
			linkThumbnail: null,
			linkUrl: null,
			textBentoId: null,
			textContent: null,
			sectionBentoId: null,
			sectionTitle: null,
			mediaBentoId: null,
			mediaType: null,
			mediaUrl: null,
			mediaObjectKey: null,
			mediaHref: null,
			mediaAlt: null,
			mediaCaption: null,
			mapBentoId: null,
			mapLatitude: null,
			mapLongitude: null,
			mapZoom: null,
			mapCaption: null,
			mapUrl: null,
			clockBentoId: null,
			clockTimezone: null,
			clockShowDate: null,
			clockShowSeconds: null,
			clockStyle: null,
		};
		const chain = {
			leftJoin: () => chain,
			where: () => chain,
			orderBy: () => Promise.resolve([row]),
		};
		const db = {
			select: () => ({
				from: () => chain,
			}),
		};
		const { app } = createEditorTestApp({
			session: null,
			db,
			bucket,
		});

		const response = await app.request("/profile/maker");
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				role: null,
				bio: null,
				image: null,
				imageCrop: null,
				backgroundImage: null,
				location: null,
				updatedAt: "2026-05-08T00:00:00.000Z",
			},
			bento: [
				{
					id: "clock-bento-1",
					type: "clock",
					layout: {
						desktop: { x: 1, y: 2, w: 3, h: 4 },
						compact: { x: 5, y: 6, w: 7, h: 8 },
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
				isAuthenticated: false,
				userId: null,
				canEdit: false,
			},
		});
	});

	it("returns a no-store 500 when a profile bento is structurally invalid", async () => {
		const bucket = createMockBucket();
		const row = {
			pageId: "page-1",
			pageUserId: "user-1",
			pageHandle: "maker",
			pageName: "Maker",
			pageRole: null,
			pageBio: null,
			pageImage: null,
			pageImageCrop: null,
			pageBackgroundImage: null,
			pageLocation: null,
			pageUpdatedAt: new Date("2026-05-08T00:00:00.000Z"),
			bentoId: "bento-1",
			bentoType: "link",
			desktopLayoutId: null,
			desktopLayoutX: null,
			desktopLayoutY: null,
			desktopLayoutW: null,
			desktopLayoutH: null,
			compactLayoutId: null,
			compactLayoutX: null,
			compactLayoutY: null,
			compactLayoutW: null,
			compactLayoutH: null,
			linkBentoId: "link-bento-1",
			linkTitle: "Link title",
			linkDescription: null,
			linkFavicon: null,
			linkThumbnail: null,
			linkUrl: "https://example.com",
			textBentoId: null,
			textContent: null,
			sectionBentoId: null,
			sectionTitle: null,
			mediaBentoId: null,
			mediaType: null,
			mediaUrl: null,
			mediaObjectKey: null,
			mediaHref: null,
			mediaAlt: null,
			mediaCaption: null,
			mapBentoId: null,
			mapLatitude: null,
			mapLongitude: null,
			mapZoom: null,
			mapCaption: null,
			mapUrl: null,
		};
		const chain = {
			leftJoin: () => chain,
			where: () => chain,
			orderBy: () => Promise.resolve([row]),
		};
		const db = {
			select: () => ({
				from: () => chain,
			}),
		};
		const { app } = createEditorTestApp({
			session: null,
			db,
			bucket,
		});

		const response = await app.request("/profile/maker");

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(await response.json()).toEqual({
			error: {
				code: "internal_error",
				message: "profile bento bento-1 is missing required layouts",
			},
		});
	});
});

describe("GET /profile/pages", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns all profile page rows without requiring a session", async () => {
		const bucket = createMockBucket();
		const pages = [
			{
				id: "page-2",
				userId: "user-2",
				handle: "maker-two",
				name: "Maker Two",
				location: "Busan",
				role: "creator",
				bio: "Second profile",
				image: "https://cdn.harune.me/avatar-2.png",
				imageCrop: null,
				backgroundImage: null,
				createdAt: new Date("2026-05-07T00:00:00.000Z"),
				updatedAt: new Date("2026-05-08T02:00:00.000Z"),
			},
			{
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				location: null,
				role: null,
				bio: null,
				image: null,
				imageCrop: null,
				backgroundImage: null,
				createdAt: new Date("2026-05-06T00:00:00.000Z"),
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
			},
		];
		const { app } = createTestApp({
			session: null,
			pages,
			bucket,
		});

		const response = await app.request("/profile/pages");
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual({
			pages: [
				{
					id: "page-2",
					userId: "user-2",
					handle: "maker-two",
					name: "Maker Two",
					location: "Busan",
					role: "creator",
					bio: "Second profile",
					image: "https://cdn.harune.me/avatar-2.png",
					imageCrop: null,
					backgroundImage: null,
					createdAt: "2026-05-07T00:00:00.000Z",
					updatedAt: "2026-05-08T02:00:00.000Z",
				},
				{
					id: "page-1",
					userId: "user-1",
					handle: "maker",
					name: "Maker",
					location: null,
					role: null,
					bio: null,
					image: null,
					imageCrop: null,
					backgroundImage: null,
					createdAt: "2026-05-06T00:00:00.000Z",
					updatedAt: "2026-05-08T01:00:00.000Z",
				},
			],
		});
	});

	it("returns 500 when the profile page list cannot be loaded", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			findProfilePages: async () => {
				throw new Error("db offline");
			},
			bucket,
		});

		const response = await app.request("/profile/pages");

		expect(response.status).toBe(500);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toEqual({
			error: {
				code: "profile_pages_failed",
				message: "failed to load profile pages",
			},
		});
	});
});

describe("profile mutation routes", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns a presigned profile image upload url", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/image",
			{
				method: "POST",
				body: JSON.stringify({
					imageKind: "profile",
					contentType: "image/png",
					contentLength: 12345,
					imageHash:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(json).toEqual({
			imageKind: "profile",
			imageHash:
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			imageUrl: buildPublicObjectUrl(
				"https://cdn.harune.me",
				getProfileImageObjectKey("user-1", "profile"),
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			),
			objectKey: getProfileImageObjectKey("user-1", "profile"),
			contentType: "image/png",
			contentLength: 12345,
			uploadUrl: expect.stringContaining("https://upload.example/"),
			expiresAt: "2026-05-08T02:00:00.000Z",
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});

	it("returns 400 when the upload metadata is malformed", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/image",
			{
				method: "POST",
				body: JSON.stringify({
					imageKind: "profile",
					contentType: "image/gif",
					contentLength: 12345,
					imageHash: "0".repeat(64),
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_image_invalid_type",
				message: "invalid image file type",
			},
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});

	it("finalizes a profile image with committed-read state", async () => {
		const bucket = createMockBucket();
		const imageFixture = await createImageFixture();
		const objectKey = getProfileImageObjectKey("user-1", "profile");
		const imageCrop = {
			croppedAreaPixels: {
				x: 12,
				y: 24,
				width: 360,
				height: 360,
			},
		};
		await bucket.bucket.put(
			objectKey,
			new Uint8Array(await imageFixture.file.arrayBuffer()),
			{
				httpMetadata: { contentType: "image/png" },
			},
		);
		const { app, getCurrentPage } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const imageUrl = buildPublicObjectUrl(
			"https://cdn.harune.me",
			objectKey,
			imageFixture.hash,
		);

		const response = await app.request(
			"/profile/image",
			{
				method: "PATCH",
				body: JSON.stringify({
					imageKind: "profile",
					imageUrl,
					imageCrop,
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual({
			imageKind: "profile",
			imageUrl,
			imageCrop,
			image: imageUrl,
			backgroundImage: null,
			updatedAt: "2026-05-08T01:00:00.000Z",
		});
		expect(getCurrentPage()?.image).toBe(imageUrl);
		expect(getCurrentPage()?.imageCrop).toEqual(imageCrop);
	});

	it("returns 403 when the finalized imageUrl belongs to another user", async () => {
		const bucket = createMockBucket();
		const { file, hash } = await createImageFixture();
		const objectKey = getProfileImageObjectKey("user-2", "profile");
		await bucket.bucket.put(
			objectKey,
			new Uint8Array(await file.arrayBuffer()),
			{
				httpMetadata: { contentType: "image/png" },
			},
		);
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/image",
			{
				method: "PATCH",
				body: JSON.stringify({
					imageKind: "profile",
					imageUrl: buildPublicObjectUrl(
						"https://cdn.harune.me",
						objectKey,
						hash,
					),
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_image_forbidden",
				message: "imageUrl does not belong to the authenticated user",
			},
		});
	});

	it("deletes a profile image object without mutating the row", async () => {
		const bucket = createMockBucket();
		const imageFixture = await createImageFixture();
		const objectKey = getProfileImageObjectKey("user-1", "background");
		await bucket.bucket.put(
			objectKey,
			new Uint8Array(await imageFixture.file.arrayBuffer()),
			{
				httpMetadata: { contentType: "image/png" },
			},
		);
		const { app, getCurrentPage } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/image",
			{
				method: "DELETE",
				body: JSON.stringify({
					imageUrl: buildPublicObjectUrl(
						"https://cdn.harune.me",
						objectKey,
						imageFixture.hash,
					),
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			success: true,
			deletedObjectKey: objectKey,
		});
		expect(bucket.bucket.delete).toHaveBeenCalledWith(objectKey);
		expect(getCurrentPage()?.backgroundImage).toBeNull();
	});

	it("returns 404 when deleting a missing profile image object", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/image",
			{
				method: "DELETE",
				body: JSON.stringify({
					imageUrl: buildPublicObjectUrl(
						"https://cdn.harune.me",
						getProfileImageObjectKey("user-1", "profile"),
						"missing",
					),
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_image_not_found",
				message: "profile image object not found",
			},
		});
		expect(bucket.bucket.delete).not.toHaveBeenCalled();
	});

	it("returns a presigned temporary bento media upload url", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			ownedBento: { id: "bento-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: JSON.stringify({
					bentoId: "bento-1",
					contentType: "video/mp4",
					contentLength: 23456,
					contentHash:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual({
			bentoId: "bento-1",
			contentHash:
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			contentType: "video/mp4",
			mediaType: "video",
			tempObjectKey: expect.stringMatching(
				/^tmp\/users\/user-1\/bento\/bento-1\/[0-9a-f-]{36}$/,
			),
			tempUrl: expect.stringContaining(
				"https://cdn.harune.me/tmp/users/user-1/bento/bento-1/",
			),
			uploadUrl: expect.stringContaining("https://upload.example/"),
			expiresAt: "2026-05-08T02:00:00.000Z",
			contentLength: 23456,
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});

	it("returns a presigned preview bento media upload url", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const previewBentoId = `preview:${crypto.randomUUID()}`;

		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: JSON.stringify({
					bentoId: previewBentoId,
					contentType: "video/mp4",
					contentLength: 23456,
					contentHash:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			bentoId: previewBentoId,
			contentHash:
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			contentType: "video/mp4",
			mediaType: "video",
			tempObjectKey: getProfileMediaObjectKey("user-1", previewBentoId),
			tempUrl: getProfileBentoMediaPublicUrl(
				"https://cdn.harune.me",
				getProfileMediaObjectKey("user-1", previewBentoId),
				"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			),
			uploadUrl: expect.stringContaining("https://upload.example/"),
			expiresAt: "2026-05-08T02:00:00.000Z",
			contentLength: 23456,
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});

	it("returns 500 when the R2 media upload config is missing", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			ownedBento: { id: "bento-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: JSON.stringify({
					bentoId: "bento-1",
					contentType: "video/mp4",
					contentLength: 23456,
					contentHash:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				R2_ACCESS_KEY_ID: "",
				R2_SECRET_ACCESS_KEY: "",
				R2_PUBLIC_BASE_URL: "",
			} as never,
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_media_upload_failed",
				message: "missing profile media upload configuration",
				details: {
					missing: expect.arrayContaining([
						"R2_ACCESS_KEY_ID",
						"R2_SECRET_ACCESS_KEY",
						"R2_PUBLIC_BASE_URL",
					]),
				},
			},
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});

	it("returns 403 when the bento does not belong to the current user", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			ownedBento: null,
			bucket,
		});
		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: JSON.stringify({
					bentoId: "bento-1",
					contentType: "video/mp4",
					contentLength: 23456,
					contentHash:
						"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_bento_forbidden",
				message: "bento does not belong to the authenticated user",
			},
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});
});

describe("PUT /profile/me onboarding create", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a profile page and returns the committed profile response", async () => {
		const bucket = createMockBucket();
		const { app, getCurrentPage, getLastCreatedInput } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "  Maker_One  ",
				name: "  Maker One  ",
				bio: "  Bio  ",
				role: "   ",
				location: "   ",
				image: "https://cdn.harune.me/avatar.png",
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(json).toEqual({
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker_one",
				name: "Maker One",
				role: null,
				bio: "Bio",
				image: "https://cdn.harune.me/avatar.png",
				imageCrop: null,
				backgroundImage: null,
				location: null,
				updatedAt: "2026-05-08T01:00:00.000Z",
			},
			bento: [],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		});
		expect(getLastCreatedInput()).toEqual({
			userId: "user-1",
			handle: "maker_one",
			name: "Maker One",
			bio: "Bio",
			role: null,
			location: null,
			image: "https://cdn.harune.me/avatar.png",
		});
		expect(getCurrentPage()?.handle).toBe("maker_one");
	});

	it("accepts a blank bio when creating a profile page", async () => {
		const bucket = createMockBucket();
		const { app, getLastCreatedInput } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker_blank_bio",
				name: "Maker Blank Bio",
				bio: "   ",
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.page.bio).toBe(null);
		expect(getLastCreatedInput()).toEqual({
			userId: "user-1",
			handle: "maker_blank_bio",
			name: "Maker Blank Bio",
			bio: null,
			role: undefined,
			location: undefined,
			image: undefined,
		});
	});

	it("accepts null role and location when creating a profile page", async () => {
		const bucket = createMockBucket();
		const { app, getLastCreatedInput } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker_nulls",
				name: "Maker Nulls",
				role: null,
				location: null,
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json.page.role).toBe(null);
		expect(json.page.location).toBe(null);
		expect(getLastCreatedInput()).toEqual({
			userId: "user-1",
			handle: "maker_nulls",
			name: "Maker Nulls",
			bio: undefined,
			role: null,
			location: null,
			image: undefined,
		});
	});

	it("returns 400 for invalid profile creation input", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "app",
				name: "",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "validation_error",
				message: "invalid request",
			},
		});
	});

	it("returns 400 for invalid null-like profile creation input", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker",
				name: "Maker",
				role: 0,
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "validation_error",
				message: "invalid request",
			},
		});
	});

	it("returns 401 when the session is missing", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: null,
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker",
				name: "Maker",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: {
				code: "unauthorized",
				message: "authentication required",
			},
		});
	});

	it("returns 409 when the profile page already exists", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: { userId: "user-1" },
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				location: null,
				role: null,
				bio: null,
				image: null,
				imageCrop: null,
				backgroundImage: null,
				updatedAt: new Date("2026-05-08T00:00:00.000Z"),
			},
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker_new",
				name: "Maker",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_page_exists",
				message: "profile page already exists",
			},
		});
	});

	it("returns 409 when the handle is already taken", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: { userId: "user-1" },
			handlePage: {
				userId: "user-2",
				handle: "maker",
			},
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker",
				name: "Maker",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: {
				code: "handle_taken",
				message: "handle already taken",
			},
		});
	});

	it("returns 404 when the authenticated user row is missing", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: { userId: "user-1" },
			userExists: false,
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				handle: "maker",
				name: "Maker",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: {
				code: "user_not_found",
				message: "user not found",
			},
		});
	});
});

describe("PUT /profile/me", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("updates only the provided profile fields and returns the committed read model", async () => {
		const bucket = createMockBucket();
		const expectedResponse = {
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Updated Maker",
				role: null,
				bio: "Updated bio",
				image: null,
				imageCrop: null,
				backgroundImage: null,
				location: null,
				updatedAt: "2026-05-08T01:00:00.000Z",
			},
			bento: [],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		};

		const { app, getLastPatch } = createEditorTestApp({
			session: { userId: "user-1" },
			getProfile: async () => ({
				...expectedResponse,
				page: {
					...expectedResponse.page,
					name: "Maker",
					bio: "Bio",
					updatedAt: "2026-05-08T00:00:00.000Z",
				},
			}),
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				name: "Updated Maker",
				bio: "Updated bio",
				role: "   ",
				location: "   ",
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual(expectedResponse);
		expect(getLastPatch()).toEqual({
			name: "Updated Maker",
			bio: "Updated bio",
			role: null,
			location: null,
		});
	});

	it("allows a blank bio to clear the saved value", async () => {
		const bucket = createMockBucket();
		const expectedResponse = {
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Updated Maker",
				role: "creator",
				bio: null,
				image: null,
				imageCrop: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T01:00:00.000Z",
			},
			bento: [],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		};

		const { app, getLastPatch } = createEditorTestApp({
			session: { userId: "user-1" },
			getProfile: async () => expectedResponse,
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				name: "Updated Maker",
				bio: "   ",
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual(expectedResponse);
		expect(getLastPatch()).toEqual({
			name: "Updated Maker",
			bio: null,
		});
	});

	it("returns 400 for invalid profile patch fields", async () => {
		const bucket = createMockBucket();
		const { app } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				name: "",
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "validation_error",
				message: "invalid request",
			},
		});
	});

	it("updates profile fields and bento in a single request", async () => {
		const bucket = createMockBucket();
		const tempBytes = new TextEncoder().encode("temp bento payload");
		const tempObjectKey = `tmp/users/user-1/bento/bento-1/${crypto.randomUUID()}`;
		await bucket.bucket.put(tempObjectKey, tempBytes, {
			httpMetadata: { contentType: "image/png" },
		});

		const { app } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				name: "Updated Maker",
				bio: "Updated bio",
				bento: [
					{
						id: "bento-1",
						type: "media",
						layout: {
							desktop: { x: 0, y: 0, w: 4, h: 4 },
							compact: { x: 0, y: 0, w: 4, h: 4 },
						},
						content: {
							mediaType: "image",
							url: "https://cdn.harune.me/placeholder?v=content-hash-123",
							objectKey: "public/users/user-1/bento/bento-1",
							tempObjectKey,
							contentHash: "content-hash-123",
							contentType: "image/png",
							alt: "Alt",
							caption: "Caption",
						},
					},
				],
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(json).toEqual({
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Updated Maker",
				role: "creator",
				bio: "Updated bio",
				image: null,
				imageCrop: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T01:00:00.000Z",
			},
			bento: [
				{
					id: "bento-1",
					type: "media",
					layout: {
						desktop: { x: 0, y: 0, w: 4, h: 4 },
						compact: { x: 0, y: 0, w: 4, h: 4 },
					},
					content: {
						mediaType: "image",
						url: getProfileBentoMediaPublicUrl(
							"https://cdn.harune.me",
							getProfileMediaObjectKey("user-1", "bento-1"),
							"content-hash-123",
						),
						objectKey: getProfileMediaObjectKey("user-1", "bento-1"),
						href: null,
						alt: "Alt",
						caption: "Caption",
					},
				},
			],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		});
		expect(bucket.bucket.put).toHaveBeenCalledWith(
			getProfileMediaObjectKey("user-1", "bento-1"),
			expect.any(Uint8Array),
			expect.any(Object),
		);
		expect(bucket.bucket.delete).toHaveBeenCalledWith(tempObjectKey);
	});

	it("defaults missing text style values when saving a text bento", async () => {
		const bucket = createMockBucket();
		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				bento: [
					{
						id: "text-bento-1",
						type: "text",
						layout: {
							desktop: { x: 0, y: 0, w: 2, h: 1 },
							compact: { x: 0, y: 0, w: 2, h: 1 },
						},
						content: {
							content: "Styled text",
							url: null,
							style: {
								backgroundColor: "#ffffff",
								textAlign: "start",
								verticalAlign: "start",
							},
						},
					},
				],
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(200);
		expect(getLastSyncedBentos()).toEqual([
			{
				id: "text-bento-1",
				type: "text",
				layout: {
					desktop: { x: 0, y: 0, w: 2, h: 1 },
					compact: { x: 0, y: 0, w: 2, h: 1 },
				},
				content: {
					content: "Styled text",
					url: null,
					style: {
						backgroundColor: "#ffffff",
						textAlign: "start",
						verticalAlign: "start",
					},
				},
			},
		]);
	});

	it("persists text urls when saving a text bento", async () => {
		const bucket = createMockBucket();
		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				bento: [
					{
						id: "text-bento-1",
						type: "text",
						layout: {
							desktop: { x: 0, y: 0, w: 2, h: 1 },
							compact: { x: 0, y: 0, w: 2, h: 1 },
						},
						content: {
							content: "Styled text",
							url: "https://example.com",
							style: {
								backgroundColor: "#ffffff",
								textAlign: "start",
								verticalAlign: "start",
							},
						},
					},
				],
			}),
			headers: {
				"content-type": "application/json",
			},
		});
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				role: "creator",
				bio: "Bio",
				image: null,
				imageCrop: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T00:00:00.000Z",
			},
			bento: [
				{
					id: "text-bento-1",
					type: "text",
					layout: {
						desktop: { x: 0, y: 0, w: 2, h: 1 },
						compact: { x: 0, y: 0, w: 2, h: 1 },
					},
					content: {
						content: "Styled text",
						url: "https://example.com/",
						style: {
							backgroundColor: "#ffffff",
							textAlign: "start",
							verticalAlign: "start",
						},
					},
				},
			],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		});
		expect(getLastSyncedBentos()).toEqual([
			{
				id: "text-bento-1",
				type: "text",
				layout: {
					desktop: { x: 0, y: 0, w: 2, h: 1 },
					compact: { x: 0, y: 0, w: 2, h: 1 },
				},
				content: {
					content: "Styled text",
					url: "https://example.com/",
					style: {
						backgroundColor: "#ffffff",
						textAlign: "start",
						verticalAlign: "start",
					},
				},
			},
		]);
	});

	it("defaults missing clock values when saving a clock bento", async () => {
		const bucket = createMockBucket();
		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				bento: [
					{
						id: "clock-bento-1",
						type: "clock",
						layout: {
							desktop: { x: 0, y: 0, w: 2, h: 1 },
							compact: { x: 0, y: 0, w: 2, h: 1 },
						},
						content: {},
					},
				],
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(200);
		expect(getLastSyncedBentos()).toEqual([
			{
				id: "clock-bento-1",
				type: "clock",
				layout: {
					desktop: { x: 0, y: 0, w: 2, h: 1 },
					compact: { x: 0, y: 0, w: 2, h: 1 },
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
		]);
	});

	it("persists clock style when saving a clock bento", async () => {
		const bucket = createMockBucket();
		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				bento: [
					{
						id: "clock-bento-1",
						type: "clock",
						layout: {
							desktop: { x: 0, y: 0, w: 2, h: 1 },
							compact: { x: 0, y: 0, w: 2, h: 1 },
						},
						content: {
							timezone: "Asia/Seoul",
							showDate: true,
							showSeconds: false,
							style: {
								backgroundColor: "#111111",
							},
						},
					},
				],
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(200);
		expect(getLastSyncedBentos()).toEqual([
			{
				id: "clock-bento-1",
				type: "clock",
				layout: {
					desktop: { x: 0, y: 0, w: 2, h: 1 },
					compact: { x: 0, y: 0, w: 2, h: 1 },
				},
				content: {
					timezone: "Asia/Seoul",
					showDate: true,
					showSeconds: false,
					style: {
						backgroundColor: "#111111",
					},
				},
			},
		]);
	});

	it("persists link metadata from the submitted bento payload", async () => {
		const bucket = createMockBucket();
		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "PUT",
			body: JSON.stringify({
				bento: [
					{
						id: "link-bento-1",
						type: "link",
						layout: {
							desktop: { x: 0, y: 0, w: 2, h: 1 },
							compact: { x: 0, y: 0, w: 2, h: 1 },
						},
						content: {
							title: "GitHub",
							description: "GitHub profile",
							favicon: "https://github.githubassets.com/favicons/favicon.svg",
							thumbnail: null,
							url: "https://github.com/octocat",
							metadata: {
								provider: "github",
								viewType: "github_contributions_60d",
								fetchedAt: "2026-05-12T00:00:00.000Z",
								domain: "github.com",
								payload: {
									login: "octocat",
									totalContributions: 31,
								},
							},
						},
					},
				],
			}),
			headers: {
				"content-type": "application/json",
			},
		});

		expect(response.status).toBe(200);
		expect(getLastSyncedBentos()).toEqual([
			{
				id: "link-bento-1",
				type: "link",
				layout: {
					desktop: { x: 0, y: 0, w: 2, h: 1 },
					compact: { x: 0, y: 0, w: 2, h: 1 },
				},
				content: {
					title: "GitHub",
					description: "GitHub profile",
					favicon: "https://github.githubassets.com/favicons/favicon.svg",
					thumbnail: null,
					url: "https://github.com/octocat",
					metadata: {
						provider: "github",
						viewType: "github_contributions_60d",
						fetchedAt: "2026-05-12T00:00:00.000Z",
						domain: "github.com",
						payload: {
							login: "octocat",
							totalContributions: 31,
						},
					},
				},
			},
		]);
	});
});
