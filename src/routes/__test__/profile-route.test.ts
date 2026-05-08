import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { R2Bucket } from "@cloudflare/workers-types";

import { handleHonoError } from "../../lib/error-utils";
import { buildPublicObjectUrl, getProfileImageObjectKey, sha256Hex } from "../../lib/profile-media";
import { createProfileRoute } from "../profile-route";
import type { AppBindings } from "../../types/app-bindings";

type SessionState = {
	userId: string;
} | null;

function createMockBucket() {
	const objects = new Map<string, { contentType: string; bytes: Uint8Array }>();

	const bucket = {
		put: vi.fn(async (key: string, body: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => {
			objects.set(key, {
				contentType: options?.httpMetadata?.contentType ?? "",
				bytes: body instanceof Uint8Array ? body : new Uint8Array(body),
			});
		}),
		head: vi.fn(async (key: string) => (objects.has(key) ? ({ key } as never) : null)),
		delete: vi.fn(async (key: string) => {
			objects.delete(key);
		}),
	} satisfies Partial<R2Bucket>;

	return { bucket: bucket as R2Bucket, objects };
}

function createTestApp({
	session,
	page,
	ownedBento,
	bucket,
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
	ownedBento?: { id: string } | null;
	bucket: ReturnType<typeof createMockBucket>;
}) {
	let currentPage =
		page ??
		{
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
		updateProfilePageImageByUserId: async (_db, userId, imageKind, imageUrl) => {
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
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
			} as never,
		);
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Pragma")).toBe("no-cache");
		expect(json).toEqual({
			imageKind: "profile",
			imageUrl: buildPublicObjectUrl(
				"https://cdn.example.com",
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
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
		await bucket.bucket.put(objectKey, new Uint8Array(await imageFixture.file.arrayBuffer()), {
			httpMetadata: { contentType: "image/png" },
		});
		const { app, getCurrentPage } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});
		const imageUrl = buildPublicObjectUrl("https://cdn.example.com", objectKey, imageFixture.hash);

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
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
		await bucket.bucket.put(objectKey, new Uint8Array(await file.arrayBuffer()), {
			httpMetadata: { contentType: "image/png" },
		});
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
					imageUrl: buildPublicObjectUrl("https://cdn.example.com", objectKey, hash),
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
		await bucket.bucket.put(objectKey, new Uint8Array(await imageFixture.file.arrayBuffer()), {
			httpMetadata: { contentType: "image/png" },
		});
		const { app, getCurrentPage } = createTestApp({
			session: { userId: "user-1" },
			bucket,
		});

		const response = await app.request(
			"/profile/image",
			{
				method: "DELETE",
				body: JSON.stringify({
					imageUrl: buildPublicObjectUrl("https://cdn.example.com", objectKey, imageFixture.hash),
				}),
				headers: {
					"content-type": "application/json",
				},
			},
			{
				PROFILE_MEDIA_BUCKET: bucket.bucket,
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
						"https://cdn.example.com",
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
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
			tempUrl: expect.stringContaining("https://cdn.example.com/tmp/users/user-1/profile/bento/bento-1/"),
		});
		expect(bucket.bucket.put).toHaveBeenCalledTimes(1);
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
				R2_PUBLIC_BASE_URL: "https://cdn.example.com",
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
