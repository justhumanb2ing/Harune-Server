import type { R2Bucket } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleHonoError } from "../../lib/error-utils";
import {
	buildPublicObjectUrl,
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
}: {
	session: SessionState;
	page?: {
		id: string;
		userId: string;
		handle: string;
		name: string | null;
		image: string | null;
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
		backgroundImage: string | null;
		linkBlockPosition: number;
		createdAt: Date;
		updatedAt: Date;
	}>;
	findProfilePages?: () => Promise<unknown>;
	ownedBento?: { id: string } | null;
	bucket: ReturnType<typeof createMockBucket>;
}) {
	let currentPage = page ?? {
		id: "page-1",
		userId: "user-1",
		handle: "maker",
		name: "Maker",
		image: null,
		backgroundImage: null,
		updatedAt: new Date("2026-05-08T00:00:00.000Z"),
	};

	const route = createProfileRoute({
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
		) => {
			if (!currentPage || currentPage.userId !== userId) {
				return;
			}

			currentPage = {
				...currentPage,
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
				...(imageKind === "profile"
					? { image: imageUrl }
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
	getProfile?: (
		db: never,
		handle: string,
		viewer: { userId: string | null },
	) => Promise<unknown>;
	syncProfileBentoGraph?: (
		db: never,
		pageId: string,
		bentos: unknown[],
	) => Promise<void>;
	bucket: ReturnType<typeof createMockBucket>;
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
				return;
			}

			currentPage = {
				...currentPage,
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
				...patch,
			};
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
		c.set("db", {} as never);
		c.set("session", session as never);
		await next();
	});
	app.onError(handleHonoError);
	app.route("/profile", route);

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
				backgroundImage: null,
				updatedAt: new Date("2026-05-08T01:00:00.000Z"),
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

async function createVideoFixture() {
	const bytes = new TextEncoder().encode("video payload");
	return {
		file: new File([bytes], "clip.mp4", { type: "video/mp4" }),
		hash: await sha256Hex(bytes),
	};
}

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
				backgroundImage: null,
				linkBlockPosition: 3,
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
				backgroundImage: null,
				linkBlockPosition: 0,
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
					backgroundImage: null,
					linkBlockPosition: 3,
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
					backgroundImage: null,
					linkBlockPosition: 0,
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

	it("uploads a profile image and returns stable metadata", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const { file, hash } = await createImageFixture();
		const formData = new FormData();
		formData.append("file", file);
		formData.append("imageHash", hash);
		formData.append("imageKind", "profile");

		const response = await app.request(
			"/profile/image",
			{
				method: "POST",
				body: formData,
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(json).toEqual({
			imageKind: "profile",
			imageUrl: buildPublicObjectUrl(
				"https://cdn.harune.me",
				getProfileImageObjectKey("user-1", "profile"),
				hash,
			),
			objectKey: getProfileImageObjectKey("user-1", "profile"),
			contentType: "image/png",
			contentLength: file.size,
		});
		expect(bucket.bucket.put).toHaveBeenCalledTimes(1);
	});

	it("returns 400 when the uploaded file hash does not match", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const { file } = await createImageFixture();
		const formData = new FormData();
		formData.append("file", file);
		formData.append("imageHash", "0".repeat(64));
		formData.append("imageKind", "profile");

		const response = await app.request(
			"/profile/image",
			{
				method: "POST",
				body: formData,
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "profile_image_hash_mismatch",
				message: "uploaded bytes hash does not match imageHash",
			},
		});
		expect(bucket.bucket.put).not.toHaveBeenCalled();
	});

	it("finalizes a profile image with committed-read state", async () => {
		const bucket = createMockBucket();
		const imageFixture = await createImageFixture();
		const objectKey = getProfileImageObjectKey("user-1", "profile");
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
			image: imageUrl,
			backgroundImage: null,
			updatedAt: "2026-05-08T01:00:00.000Z",
		});
		expect(getCurrentPage()?.image).toBe(imageUrl);
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

	it("uploads temporary bento media metadata only", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			ownedBento: { id: "bento-1" },
			bucket,
		});
		const { file, hash } = await createVideoFixture();
		const formData = new FormData();
		formData.append("file", file);
		formData.append("bentoId", "bento-1");

		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: formData,
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
			bentoId: "bento-1",
			contentHash: hash,
			contentType: "video/mp4",
			mediaType: "video",
			tempObjectKey: expect.stringMatching(
				/^tmp\/users\/user-1\/profile\/bento\/bento-1\/[0-9a-f-]{36}$/,
			),
			tempUrl: expect.stringContaining(
				"https://cdn.harune.me/tmp/users/user-1/profile/bento/bento-1/",
			),
		});
		expect(bucket.bucket.put).toHaveBeenCalledTimes(1);
	});

	it("uploads preview bento media directly to a public preview object key", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const { file, hash } = await createVideoFixture();
		const previewBentoId = `preview:${crypto.randomUUID()}`;
		const formData = new FormData();
		formData.append("file", file);
		formData.append("bentoId", previewBentoId);

		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: formData,
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.harune.me",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			bentoId: previewBentoId,
			contentHash: hash,
			contentType: "video/mp4",
			mediaType: "video",
			tempObjectKey: getProfileMediaObjectKey("user-1", previewBentoId),
			tempUrl: getProfileBentoMediaPublicUrl(
				"https://cdn.harune.me",
				getProfileMediaObjectKey("user-1", previewBentoId),
				hash,
			),
		});
		expect(bucket.bucket.put).toHaveBeenCalledTimes(1);
		expect(bucket.bucket.put).toHaveBeenCalledWith(
			getProfileMediaObjectKey("user-1", previewBentoId),
			expect.any(Uint8Array),
			{
				httpMetadata: { contentType: "video/mp4" },
			},
		);
	});

	it("returns 403 when the bento does not belong to the current user", async () => {
		const bucket = createMockBucket();
		const { app } = createTestApp({
			session: { userId: "user-1" },
			ownedBento: null,
			bucket,
		});
		const { file } = await createVideoFixture();
		const formData = new FormData();
		formData.append("file", file);
		formData.append("bentoId", "bento-1");

		const response = await app.request(
			"/profile/bento/media/upload",
			{
				method: "POST",
				body: formData,
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
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

describe("POST /profile/me", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a profile page and returns the committed page only", async () => {
		const bucket = createMockBucket();
		const { app, getCurrentPage, getLastCreatedInput } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "POST",
			body: JSON.stringify({
				handle: "  Maker_One  ",
				name: "  Maker One  ",
				bio: "  Bio  ",
				role: "  Creator  ",
				location: "  Seoul  ",
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
				role: "Creator",
				bio: "Bio",
				image: "https://cdn.harune.me/avatar.png",
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T01:00:00.000Z",
			},
		});
		expect(getLastCreatedInput()).toEqual({
			userId: "user-1",
			handle: "maker_one",
			name: "Maker One",
			bio: "Bio",
			role: "Creator",
			location: "Seoul",
			image: "https://cdn.harune.me/avatar.png",
		});
		expect(getCurrentPage()?.handle).toBe("maker_one");
	});

	it("returns 400 for invalid profile creation input", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "POST",
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

	it("returns 401 when the session is missing", async () => {
		const bucket = createMockBucket();
		const { app } = createCreateTestApp({
			session: null,
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "POST",
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
				backgroundImage: null,
				updatedAt: new Date("2026-05-08T00:00:00.000Z"),
			},
			bucket,
		});

		const response = await app.request("/profile/me", {
			method: "POST",
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
			method: "POST",
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
			method: "POST",
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
				role: "creator",
				bio: "Updated bio",
				image: null,
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
				bio: "Updated bio",
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
});

describe("PUT /profile/me/bento", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("promotes temp media to the final object key and syncs the replacement graph", async () => {
		const bucket = createMockBucket();
		const tempBytes = new TextEncoder().encode("temp bento payload");
		const tempObjectKey = `tmp/users/user-1/profile/bento/bento-1/${crypto.randomUUID()}`;
		await bucket.bucket.put(tempObjectKey, tempBytes, {
			httpMetadata: { contentType: "image/png" },
		});

		const expectedResponse = {
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				role: "creator",
				bio: "Bio",
				image: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T00:00:00.000Z",
			},
			bento: [],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		};

		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const response = await app.request(
			"/profile/me/bento",
			{
				method: "PUT",
				body: JSON.stringify({
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
								objectKey: "public/users/user-1/profile/bento/bento-1/media",
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
			...expectedResponse,
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
		});
		expect(bucket.bucket.put).toHaveBeenCalledTimes(2);
		expect(bucket.bucket.delete).toHaveBeenCalledWith(tempObjectKey);
		expect(getLastSyncedBentos()).toEqual([
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
		]);
	});

	it("returns 400 when temp media ownership does not match", async () => {
		const bucket = createMockBucket();
		const { app } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request("/profile/me/bento", {
			method: "PUT",
			body: JSON.stringify({
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
							objectKey: "public/users/user-1/profile/bento/bento-1/media",
							tempObjectKey: "tmp/users/user-2/profile/bento/bento-1/asset",
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

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "invalid_media_upload_ownership",
				message: "Invalid media upload ownership.",
			},
		});
	});

	it("promotes preview media by resolving the temp object under the preview prefix", async () => {
		const bucket = createMockBucket();
		const tempBytes = new TextEncoder().encode("preview bento payload");
		const previewBentoId = `preview:${crypto.randomUUID()}`;
		const encodedPreviewBentoId = encodeURIComponent(previewBentoId);
		const tempObjectKey = `tmp/users/user-1/profile/bento/${previewBentoId}/${crypto.randomUUID()}`;
		const contentHash = await sha256Hex(tempBytes);

		await bucket.bucket.put(tempObjectKey, tempBytes, {
			httpMetadata: { contentType: "image/png" },
		});

		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const response = await app.request(
			"/profile/me/bento",
			{
				method: "PUT",
				body: JSON.stringify({
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
								url: `https://cdn.harune.me/public/users/user-1/profile/bento/${encodedPreviewBentoId}/media`,
								objectKey: `public/users/user-1/profile/bento/${encodedPreviewBentoId}/media`,
								href: null,
								alt: "Alt",
								caption: "Caption",
							},
						},
					],
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

		expect(response.status).toBe(200);
		expect(bucket.bucket.put).toHaveBeenCalledTimes(2);
		expect(bucket.bucket.delete).toHaveBeenCalledWith(tempObjectKey);
		expect(getLastSyncedBentos()).toEqual([
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
						contentHash,
					),
					objectKey: getProfileMediaObjectKey("user-1", "bento-1"),
					href: null,
					alt: "Alt",
					caption: "Caption",
				},
			},
		]);
	});

	it("accepts a preview public object key without temp promotion", async () => {
		const bucket = createMockBucket();
		const previewBentoId = `preview:${crypto.randomUUID()}`;
		const previewObjectKey = `public/users/user-1/profile/bento/${previewBentoId}/media`;
		const previewBytes = new TextEncoder().encode("preview public payload");
		const contentHash = await sha256Hex(previewBytes);

		await bucket.bucket.put(previewObjectKey, previewBytes, {
			httpMetadata: { contentType: "image/png" },
		});

		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const response = await app.request(
			"/profile/me/bento",
			{
				method: "PUT",
				body: JSON.stringify({
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
									previewObjectKey,
									contentHash,
								),
								objectKey: previewObjectKey,
								contentHash,
								contentType: "image/png",
								href: null,
								alt: "Alt",
								caption: "Caption",
							},
						},
					],
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
		expect(bucket.bucket.put).toHaveBeenCalledTimes(1);
		expect(bucket.bucket.delete).not.toHaveBeenCalled();
		expect(json).toEqual({
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				role: "creator",
				bio: "Bio",
				image: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T00:00:00.000Z",
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
							previewObjectKey,
							contentHash,
						),
						objectKey: previewObjectKey,
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
		expect(getLastSyncedBentos()).toEqual([
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
						previewObjectKey,
						contentHash,
					),
					objectKey: previewObjectKey,
					href: null,
					alt: "Alt",
					caption: "Caption",
				},
			},
		]);
	});

	it("accepts a public preview object key in tempObjectKey without copying on save", async () => {
		const bucket = createMockBucket();
		const tempBytes = new TextEncoder().encode("preview bento payload");
		const previewBentoId = `preview:${crypto.randomUUID()}`;
		const previewObjectKey = getProfileMediaObjectKey("user-1", previewBentoId);
		const contentHash = await sha256Hex(tempBytes);

		await bucket.bucket.put(previewObjectKey, tempBytes, {
			httpMetadata: { contentType: "image/png" },
		});

		const { app, getLastSyncedBentos } = createEditorTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const response = await app.request(
			"/profile/me/bento",
			{
				method: "PUT",
				body: JSON.stringify({
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
									previewObjectKey,
									contentHash,
								),
								objectKey: previewObjectKey,
								tempObjectKey: previewObjectKey,
								contentHash,
								contentType: "image/png",
								href: null,
								alt: "Alt",
								caption: "Caption",
							},
						},
					],
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
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				role: "creator",
				bio: "Bio",
				image: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-08T00:00:00.000Z",
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
							previewObjectKey,
							contentHash,
						),
						objectKey: previewObjectKey,
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
		expect(bucket.bucket.put).toHaveBeenCalledTimes(1);
		expect(bucket.bucket.delete).not.toHaveBeenCalled();
		expect(getLastSyncedBentos()).toEqual([
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
						previewObjectKey,
						contentHash,
					),
					objectKey: previewObjectKey,
					href: null,
					alt: "Alt",
					caption: "Caption",
				},
			},
		]);
	});
});
