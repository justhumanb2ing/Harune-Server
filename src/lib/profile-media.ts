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
	return `public/users/${userId}/profile-page/${imageKind}`;
}

export function getProfileMediaTempObjectKey(
	userId: string,
	bentoId: string,
	objectId = crypto.randomUUID(),
) {
	return `tmp/users/${userId}/profile-page/bento/${bentoId}/${objectId}`;
}

export function getProfileMediaObjectKey(userId: string, bentoId: string) {
	return `public/users/${userId}/profile-page/bento/${bentoId}/media`;
}

export function getProfileMediaTempUrl(baseUrl: string, objectKey: string) {
	const url = new URL("/profile/bento/media", baseUrl);
	url.searchParams.set("key", objectKey);
	return url.toString();
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

		return url.pathname.slice(expectedPrefix.length);
	} catch {
		return null;
	}
}

export function parseProfileMediaTempObjectKey(tempObjectKey: string) {
	const segments = tempObjectKey.split("/");

	if (
		segments.length !== 7 ||
		segments[0] !== "tmp" ||
		segments[1] !== "users" ||
		segments[3] !== "profile-page" ||
		segments[4] !== "bento"
	) {
		return null;
	}

	const userId = segments[2];
	const bentoId = segments[5];
	const objectId = segments[6];

	if (!userId || !bentoId || !objectId) {
		return null;
	}

	return {
		objectKey: tempObjectKey,
		userId,
		bentoId,
		objectId,
	} as const;
}

export async function sha256Hex(input: ArrayBuffer | Uint8Array) {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(hash))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}
