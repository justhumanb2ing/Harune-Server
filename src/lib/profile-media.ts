import type { R2Bucket } from "@cloudflare/workers-types";

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROFILE_MEDIA_BYTES = 5 * 1024 * 1024;

const PROFILE_IMAGE_CONTENT_TYPES = new Set([
	"image/avif",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

type ProfileImageKind = "profile" | "background";
type ProfileMediaType = "image" | "video";

function normalizeContentType(contentType: string) {
	return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function decodeObjectKeySegment(segment: string) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return null;
	}
}

export function normalizeProfileMediaObjectKey(objectKey: string) {
	const segments = objectKey.split("/");
	const normalizedSegments: string[] = [];

	for (const segment of segments) {
		const decoded = decodeObjectKeySegment(segment);

		if (decoded === null) {
			return null;
		}

		normalizedSegments.push(decoded);
	}

	return normalizedSegments.join("/");
}

export function isAllowedProfileImageContentType(contentType: string) {
	return PROFILE_IMAGE_CONTENT_TYPES.has(normalizeContentType(contentType));
}

export function getProfileMediaType(contentType: string): ProfileMediaType | null {
	const normalized = normalizeContentType(contentType);

	if (normalized.startsWith("image/")) {
		return "image";
	}

	if (normalized.startsWith("video/")) {
		return "video";
	}

	return null;
}

export function isAllowedProfileMediaContentType(contentType: string) {
	return getProfileMediaType(contentType) !== null;
}

export function getProfileImageObjectKey(userId: string, imageKind: ProfileImageKind) {
	return `public/users/${userId}/profile/${imageKind}`;
}

export function getProfileMediaTempObjectKey(
	userId: string,
	bentoId: string,
	objectId = crypto.randomUUID(),
) {
	return `tmp/users/${userId}/profile/bento/${bentoId}/${objectId}`;
}

export function getProfileMediaTempObjectPrefix(userId: string, bentoId: string) {
	return `tmp/users/${userId}/profile/bento/${bentoId}/`;
}

export function getProfileMediaObjectKey(userId: string, bentoId: string) {
	return `public/users/${userId}/profile/bento/${bentoId}/media`;
}

export function getProfileBentoMediaPublicUrl(
	baseUrl: string,
	objectKey: string,
	contentHash: string,
) {
	return buildPublicObjectUrl(baseUrl, objectKey, contentHash);
}

export function isProfileBentoMediaObjectKeyForBento(
	objectKey: string,
	userId: string,
	bentoId: string,
) {
	const parsed = parseProfileBentoMediaObjectKey(objectKey);

	if (!parsed) {
		return false;
	}

	return parsed.userId === userId && parsed.bentoId === bentoId;
}

export function parseProfileBentoMediaObjectKey(objectKey: string) {
	const normalizedObjectKey = normalizeProfileMediaObjectKey(objectKey);

	if (!normalizedObjectKey) {
		return null;
	}

	const segments = normalizedObjectKey.split("/");

	if (segments.length === 7 && segments[0] === "tmp" && segments[1] === "users" && segments[3] === "profile" && segments[4] === "bento") {
		const bentoId = decodeObjectKeySegment(segments[5] ?? "");
		const objectId = decodeObjectKeySegment(segments[6] ?? "");

		if (!bentoId || !objectId) {
			return null;
		}

		return {
			kind: "temp" as const,
			userId: segments[2],
			bentoId,
			objectId,
		};
	}

	if (segments.length === 7 && segments[0] === "public" && segments[1] === "users" && segments[3] === "profile" && segments[4] === "bento" && segments[6] === "media") {
		const bentoId = decodeObjectKeySegment(segments[5] ?? "");
		const objectId = decodeObjectKeySegment(segments[6] ?? "");

		if (!bentoId || !objectId) {
			return null;
		}

		return {
			kind: "final" as const,
			userId: segments[2],
			bentoId,
			objectId,
		};
	}

	return null;
}

export async function copyProfileBentoMediaObject(
	bucket: R2Bucket,
	sourceObjectKey: string,
	targetObjectKey: string,
) {
	const object = await bucket.get(sourceObjectKey);

	if (!object) {
		throw new Error("temporary bento media object not found");
	}

	const bytes = new Uint8Array(await object.arrayBuffer());
	const contentType = object.httpMetadata?.contentType ?? "application/octet-stream";
	const contentHash = await sha256Hex(bytes);

	await bucket.put(targetObjectKey, bytes, {
		httpMetadata: {
			contentType,
		},
	});

	return {
		contentHash,
		contentType,
	};
}

export async function deleteProfileBentoMediaObject(
	bucket: R2Bucket,
	objectKey: string,
) {
	await bucket.delete(objectKey);
}

export function buildPublicObjectUrl(
	baseUrl: string,
	objectKey: string,
	version?: string,
) {
	const base = new URL(baseUrl);
	const pathname = base.pathname.replace(/\/$/, "");
	const url = new URL(base.toString());

	url.pathname = `${pathname}/${objectKey}`;

	if (version) {
		url.searchParams.set("v", version);
	}

	return url.toString();
}

export function parseObjectKeyFromPublicUrl(baseUrl: string, publicUrl: string) {
	try {
		const base = new URL(baseUrl);
		const url = new URL(publicUrl);

		if (base.origin !== url.origin) {
			return null;
		}

		const basePath = base.pathname.replace(/\/$/, "");
		const expectedPrefix = `${basePath}/`;

		if (!url.pathname.startsWith(expectedPrefix)) {
			return null;
		}

		return decodeObjectKeySegment(url.pathname.slice(expectedPrefix.length));
	} catch {
		return null;
	}
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array) {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(hash))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}
