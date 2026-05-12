import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "../lib/db";
import { users } from "../schemas/base";
import {
	profileBentoLayouts,
	profileBentos,
	profileLinkBentos,
	profileMapBentos,
	profileMediaBentos,
	profilePages,
	profileSectionBentos,
	profileTextBentos,
} from "../schemas/profile";
import type { LinkBentoMetadata } from "../types/profile";

const desktopBentoLayout = alias(profileBentoLayouts, "desktop_bento_layout");
const compactBentoLayout = alias(profileBentoLayouts, "compact_bento_layout");

export type ProfilePageSummary = {
	id: string;
	userId: string;
	handle: string;
	name: string | null;
	location?: string | null;
	role?: string | null;
	bio?: string | null;
	image: string | null;
	backgroundImage: string | null;
	updatedAt: Date;
};

export type ProfilePageRecord = {
	id: string;
	userId: string;
	handle: string;
	name: string | null;
	location: string | null;
	role: string | null;
	bio: string | null;
	image: string | null;
	backgroundImage: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ProfilePagePatch = {
	name?: string | null;
	location?: string | null;
	role?: string | null;
	bio?: string | null;
	image?: string | null;
	backgroundImage?: string | null;
};

export type ProfilePageCreateInput = {
	userId: string;
	handle: string;
	name: string;
	location?: string | null;
	role?: string | null;
	bio?: string | null;
	image?: string | null;
};

export type ProfileBentoLayoutSnapshot = {
	desktop: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
	compact: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
};

export type ProfileBentoSnapshot =
	| {
			id: string;
			type: "link";
			layout: ProfileBentoLayoutSnapshot;
			content: {
				title: string;
				description: string | null;
				favicon: string | null;
				thumbnail: string | null;
				url: string;
				metadata: LinkBentoMetadata | null;
			};
	  }
	| {
			id: string;
			type: "text";
			layout: ProfileBentoLayoutSnapshot;
			content: {
				content: string;
			};
	  }
	| {
			id: string;
			type: "section";
			layout: ProfileBentoLayoutSnapshot;
			content: {
				title: string;
			};
	  }
	| {
			id: string;
			type: "media";
			layout: ProfileBentoLayoutSnapshot;
			content: {
				mediaType: "image" | "video";
				url: string;
				objectKey: string;
				tempObjectKey?: string | null;
				contentHash?: string | null;
				contentType?: string | null;
				href: string | null;
				alt: string;
				caption: string;
			};
	  }
	| {
			id: string;
			type: "map";
			layout: ProfileBentoLayoutSnapshot;
			content: {
				latitude: number;
				longitude: number;
				zoom: number;
				caption: string;
				url: string;
			};
	  };

export type ProfileBentoRow = {
	pageId: string;
	bentoId: string | null;
	bentoType: "link" | "text" | "section" | "media" | "map" | null;
	desktopLayoutId: string | null;
	desktopLayoutBreakdown?: "desktop" | "compact" | null;
	desktopLayoutX: number | null;
	desktopLayoutY: number | null;
	desktopLayoutW: number | null;
	desktopLayoutH: number | null;
	compactLayoutId: string | null;
	compactLayoutBreakdown?: "desktop" | "compact" | null;
	compactLayoutX: number | null;
	compactLayoutY: number | null;
	compactLayoutW: number | null;
	compactLayoutH: number | null;
	linkBentoId: string | null;
	linkTitle: string | null;
	linkDescription: string | null;
	linkFavicon: string | null;
	linkThumbnail: string | null;
	linkUrl: string | null;
	linkMetadata: Record<string, unknown> | null;
	textBentoId: string | null;
	textContent: string | null;
	sectionBentoId: string | null;
	sectionTitle: string | null;
	mediaBentoId: string | null;
	mediaType: "image" | "video" | null;
	mediaUrl: string | null;
	mediaObjectKey: string | null;
	mediaHref: string | null;
	mediaAlt: string | null;
	mediaCaption: string | null;
	mapBentoId: string | null;
	mapLatitude: number | null;
	mapLongitude: number | null;
	mapZoom: number | null;
	mapCaption: string | null;
	mapUrl: string | null;
};

type ProfileBentoIdMode = "public" | "canonical";

function requireValue<T>(value: T | null | undefined, message: string): T {
	if (value === null || value === undefined) {
		throw new Error(message);
	}

	return value;
}

function profileInvariantError(code: string, message: string) {
	return new Error(message, { cause: { error: code } });
}

function getProfileBentoSnapshotId(
	row: ProfileBentoRow,
	idMode: ProfileBentoIdMode,
) {
	if (idMode === "canonical") {
		return row.bentoId;
	}

	switch (row.bentoType) {
		case "link":
			return row.linkBentoId;
		case "text":
			return row.textBentoId;
		case "section":
			return row.sectionBentoId;
		case "media":
			return row.mediaBentoId;
		case "map":
			return row.mapBentoId;
		default:
			return null;
	}
}

function buildProfileBentoSnapshot(
	row: ProfileBentoRow,
	idMode: ProfileBentoIdMode = "public",
): ProfileBentoSnapshot {
	const id = getProfileBentoSnapshotId(row, idMode);

	if (!row.desktopLayoutId || !row.compactLayoutId) {
		throw profileInvariantError(
			"profile_layout_missing",
			`profile bento ${row.bentoId} is missing required layouts`,
		);
	}

	const layout = {
		desktop: {
			x: requireValue(
				row.desktopLayoutX,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
			y: requireValue(
				row.desktopLayoutY,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
			w: requireValue(
				row.desktopLayoutW,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
			h: requireValue(
				row.desktopLayoutH,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
		},
		compact: {
			x: requireValue(
				row.compactLayoutX,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
			y: requireValue(
				row.compactLayoutY,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
			w: requireValue(
				row.compactLayoutW,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
			h: requireValue(
				row.compactLayoutH,
				`profile bento ${row.bentoId} is missing required layouts`,
			),
		},
	};

	switch (row.bentoType) {
		case "link":
			if (!row.linkBentoId) {
				throw profileInvariantError(
					"profile_link_bento_missing",
					`profile link bento ${row.bentoId} is missing content`,
				);
			}

			return {
				id: requireValue(id, `profile link bento ${row.bentoId} is missing id`),
				type: "link",
				layout,
					content: {
						title: requireValue(
							row.linkTitle,
							`profile link bento ${row.bentoId} is missing content`,
						),
					description: row.linkDescription,
					favicon: row.linkFavicon,
					thumbnail: row.linkThumbnail,
						url: requireValue(
							row.linkUrl,
							`profile link bento ${row.bentoId} is missing content`,
						),
						metadata: (row.linkMetadata ?? null) as LinkBentoMetadata | null,
					},
				};
		case "text":
			if (!row.textBentoId) {
				throw profileInvariantError(
					"profile_text_bento_missing",
					`profile text bento ${row.bentoId} is missing content`,
				);
			}

			return {
				id: requireValue(id, `profile text bento ${row.bentoId} is missing id`),
				type: "text",
				layout,
				content: {
					content: requireValue(
						row.textContent,
						`profile text bento ${row.bentoId} is missing content`,
					),
				},
			};
		case "section":
			if (!row.sectionBentoId) {
				throw profileInvariantError(
					"profile_section_bento_missing",
					`profile section bento ${row.bentoId} is missing content`,
				);
			}

			return {
				id: requireValue(
					id,
					`profile section bento ${row.bentoId} is missing id`,
				),
				type: "section",
				layout,
				content: {
					title: requireValue(
						row.sectionTitle,
						`profile section bento ${row.bentoId} is missing content`,
					),
				},
			};
		case "media":
			if (!row.mediaBentoId) {
				throw profileInvariantError(
					"profile_media_bento_missing",
					`profile media bento ${row.bentoId} is missing content`,
				);
			}

			return {
				id: requireValue(
					id,
					`profile media bento ${row.bentoId} is missing id`,
				),
				type: "media",
				layout,
				content: {
					mediaType: requireValue(
						row.mediaType,
						`profile media bento ${row.bentoId} is missing content`,
					),
					url: requireValue(
						row.mediaUrl,
						`profile media bento ${row.bentoId} is missing content`,
					),
					objectKey: requireValue(
						row.mediaObjectKey,
						`profile media bento ${row.bentoId} is missing content`,
					),
					href: row.mediaHref,
					alt: requireValue(
						row.mediaAlt,
						`profile media bento ${row.bentoId} is missing content`,
					),
					caption: requireValue(
						row.mediaCaption,
						`profile media bento ${row.bentoId} is missing content`,
					),
				},
			};
		case "map":
			if (!row.mapBentoId) {
				throw profileInvariantError(
					"profile_map_bento_missing",
					`profile map bento ${row.bentoId} is missing content`,
				);
			}

			return {
				id: requireValue(id, `profile map bento ${row.bentoId} is missing id`),
				type: "map",
				layout,
				content: {
					latitude: requireValue(
						row.mapLatitude,
						`profile map bento ${row.bentoId} is missing content`,
					),
					longitude: requireValue(
						row.mapLongitude,
						`profile map bento ${row.bentoId} is missing content`,
					),
					zoom: requireValue(
						row.mapZoom,
						`profile map bento ${row.bentoId} is missing content`,
					),
					caption: requireValue(
						row.mapCaption,
						`profile map bento ${row.bentoId} is missing content`,
					),
					url: requireValue(
						row.mapUrl,
						`profile map bento ${row.bentoId} is missing content`,
					),
				},
			};
		default:
			throw profileInvariantError(
				"profile_bento_type_invalid",
				`profile bento ${row.bentoId} has unsupported type`,
			);
	}
}

export function buildProfileBentosFromRows(
	rows: ProfileBentoRow[],
	idMode: ProfileBentoIdMode = "public",
) {
	const bentos = new Map<string, ProfileBentoSnapshot>();

	for (const row of rows) {
		if (!row.bentoId) {
			continue;
		}

		if (!bentos.has(row.bentoId)) {
			bentos.set(row.bentoId, buildProfileBentoSnapshot(row, idMode));
		}
	}

	return Array.from(bentos.values());
}

function buildProfileBentoGraphSignature(bentos: ProfileBentoSnapshot[]) {
	return JSON.stringify(
		[...bentos]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((bento) => ({
				id: bento.id,
				type: bento.type,
				layout: bento.layout,
				content: bento.content,
			})),
	);
}

export async function findProfileBentoSnapshotsByPageId(
	db: Database,
	pageId: string,
) {
	const rows = await findProfileRowsByPageId(db, pageId);
	return buildProfileBentosFromRows(rows);
}

export async function findProfileRowsByHandle(db: Database, handle: string) {
	return db
		.select({
			pageId: profilePages.id,
			pageUserId: profilePages.userId,
			pageHandle: profilePages.handle,
			pageName: profilePages.name,
			pageRole: profilePages.role,
			pageBio: profilePages.bio,
			pageImage: profilePages.image,
			pageBackgroundImage: profilePages.backgroundImage,
			pageLocation: profilePages.location,
			pageUpdatedAt: profilePages.updatedAt,
			bentoId: profileBentos.id,
			bentoType: profileBentos.type,
			desktopLayoutId: desktopBentoLayout.id,
			desktopLayoutX: desktopBentoLayout.x,
			desktopLayoutY: desktopBentoLayout.y,
			desktopLayoutW: desktopBentoLayout.w,
			desktopLayoutH: desktopBentoLayout.h,
			compactLayoutId: compactBentoLayout.id,
			compactLayoutX: compactBentoLayout.x,
			compactLayoutY: compactBentoLayout.y,
			compactLayoutW: compactBentoLayout.w,
			compactLayoutH: compactBentoLayout.h,
			linkBentoId: profileLinkBentos.id,
			linkTitle: profileLinkBentos.title,
			linkDescription: profileLinkBentos.description,
			linkFavicon: profileLinkBentos.favicon,
			linkThumbnail: profileLinkBentos.thumbnail,
			linkUrl: profileLinkBentos.url,
			linkMetadata: profileLinkBentos.metadata,
			textBentoId: profileTextBentos.id,
			textContent: profileTextBentos.content,
			sectionBentoId: profileSectionBentos.id,
			sectionTitle: profileSectionBentos.title,
			mediaBentoId: profileMediaBentos.id,
			mediaType: profileMediaBentos.mediaType,
			mediaUrl: profileMediaBentos.url,
			mediaObjectKey: profileMediaBentos.objectKey,
			mediaHref: profileMediaBentos.href,
			mediaAlt: profileMediaBentos.alt,
			mediaCaption: profileMediaBentos.caption,
			mapBentoId: profileMapBentos.id,
			mapLatitude: profileMapBentos.latitude,
			mapLongitude: profileMapBentos.longitude,
			mapZoom: profileMapBentos.zoom,
			mapCaption: profileMapBentos.caption,
			mapUrl: profileMapBentos.url,
		})
		.from(profilePages)
		.leftJoin(profileBentos, eq(profileBentos.profilePageId, profilePages.id))
		.leftJoin(
			desktopBentoLayout,
			and(
				eq(desktopBentoLayout.bentoId, profileBentos.id),
				eq(desktopBentoLayout.breakpoint, "desktop"),
			),
		)
		.leftJoin(
			compactBentoLayout,
			and(
				eq(compactBentoLayout.bentoId, profileBentos.id),
				eq(compactBentoLayout.breakpoint, "compact"),
			),
		)
		.leftJoin(
			profileLinkBentos,
			and(
				eq(profileLinkBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "link"),
			),
		)
		.leftJoin(
			profileTextBentos,
			and(
				eq(profileTextBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "text"),
			),
		)
		.leftJoin(
			profileSectionBentos,
			and(
				eq(profileSectionBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "section"),
			),
		)
		.leftJoin(
			profileMediaBentos,
			and(
				eq(profileMediaBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "media"),
			),
		)
		.leftJoin(
			profileMapBentos,
			and(
				eq(profileMapBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "map"),
			),
		)
		.where(eq(profilePages.handle, handle))
		.orderBy(asc(profileBentos.createdAt), asc(profileBentos.id));
}

export async function findProfilePageByHandle(db: Database, handle: string) {
	const rows = await db
		.select({
			userId: profilePages.userId,
			handle: profilePages.handle,
		})
		.from(profilePages)
		.where(eq(profilePages.handle, handle))
		.limit(1);

	return rows[0] ?? null;
}

export async function findUserById(db: Database, userId: string) {
	const rows = await db
		.select({
			id: users.id,
		})
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return rows[0] ?? null;
}

export async function findProfilePageByUserId(db: Database, userId: string) {
	const rows = await db
		.select({
			id: profilePages.id,
			userId: profilePages.userId,
			handle: profilePages.handle,
			name: profilePages.name,
			location: profilePages.location,
			role: profilePages.role,
			bio: profilePages.bio,
			image: profilePages.image,
			backgroundImage: profilePages.backgroundImage,
			updatedAt: profilePages.updatedAt,
		})
		.from(profilePages)
		.where(eq(profilePages.userId, userId))
		.orderBy(desc(profilePages.updatedAt), desc(profilePages.createdAt))
		.limit(1);

	return rows[0] ?? null;
}

export async function findProfilePages(db: Database) {
	return db
		.select({
			id: profilePages.id,
			userId: profilePages.userId,
			handle: profilePages.handle,
			name: profilePages.name,
			location: profilePages.location,
			role: profilePages.role,
			bio: profilePages.bio,
			image: profilePages.image,
			backgroundImage: profilePages.backgroundImage,
			createdAt: profilePages.createdAt,
			updatedAt: profilePages.updatedAt,
		})
		.from(profilePages)
		.orderBy(desc(profilePages.updatedAt), desc(profilePages.createdAt));
}

export async function findProfileRowsByPageId(db: Database, pageId: string) {
	return db
		.select({
			pageId: profilePages.id,
			bentoId: profileBentos.id,
			bentoType: profileBentos.type,
			desktopLayoutId: desktopBentoLayout.id,
			desktopLayoutBreakdown: desktopBentoLayout.breakpoint,
			desktopLayoutX: desktopBentoLayout.x,
			desktopLayoutY: desktopBentoLayout.y,
			desktopLayoutW: desktopBentoLayout.w,
			desktopLayoutH: desktopBentoLayout.h,
			compactLayoutId: compactBentoLayout.id,
			compactLayoutBreakdown: compactBentoLayout.breakpoint,
			compactLayoutX: compactBentoLayout.x,
			compactLayoutY: compactBentoLayout.y,
			compactLayoutW: compactBentoLayout.w,
			compactLayoutH: compactBentoLayout.h,
			linkBentoId: profileLinkBentos.id,
			linkTitle: profileLinkBentos.title,
			linkDescription: profileLinkBentos.description,
			linkFavicon: profileLinkBentos.favicon,
			linkThumbnail: profileLinkBentos.thumbnail,
			linkUrl: profileLinkBentos.url,
			linkMetadata: profileLinkBentos.metadata,
			textBentoId: profileTextBentos.id,
			textContent: profileTextBentos.content,
			sectionBentoId: profileSectionBentos.id,
			sectionTitle: profileSectionBentos.title,
			mediaBentoId: profileMediaBentos.id,
			mediaType: profileMediaBentos.mediaType,
			mediaUrl: profileMediaBentos.url,
			mediaObjectKey: profileMediaBentos.objectKey,
			mediaHref: profileMediaBentos.href,
			mediaAlt: profileMediaBentos.alt,
			mediaCaption: profileMediaBentos.caption,
			mapBentoId: profileMapBentos.id,
			mapLatitude: profileMapBentos.latitude,
			mapLongitude: profileMapBentos.longitude,
			mapZoom: profileMapBentos.zoom,
			mapCaption: profileMapBentos.caption,
			mapUrl: profileMapBentos.url,
		})
		.from(profilePages)
		.leftJoin(profileBentos, eq(profileBentos.profilePageId, profilePages.id))
		.leftJoin(
			desktopBentoLayout,
			and(
				eq(desktopBentoLayout.bentoId, profileBentos.id),
				eq(desktopBentoLayout.breakpoint, "desktop"),
			),
		)
		.leftJoin(
			compactBentoLayout,
			and(
				eq(compactBentoLayout.bentoId, profileBentos.id),
				eq(compactBentoLayout.breakpoint, "compact"),
			),
		)
		.leftJoin(
			profileLinkBentos,
			and(
				eq(profileLinkBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "link"),
			),
		)
		.leftJoin(
			profileTextBentos,
			and(
				eq(profileTextBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "text"),
			),
		)
		.leftJoin(
			profileSectionBentos,
			and(
				eq(profileSectionBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "section"),
			),
		)
		.leftJoin(
			profileMediaBentos,
			and(
				eq(profileMediaBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "media"),
			),
		)
		.leftJoin(
			profileMapBentos,
			and(
				eq(profileMapBentos.bentoId, profileBentos.id),
				eq(profileBentos.type, "map"),
			),
		)
		.where(eq(profilePages.id, pageId))
		.orderBy(asc(profileBentos.createdAt), asc(profileBentos.id));
}

export async function updateProfilePageByUserId(
	db: Database,
	userId: string,
	patch: ProfilePagePatch,
) {
	const nextValues: Partial<typeof profilePages.$inferInsert> = {
		updatedAt: new Date(),
	};

	if (patch.name !== undefined) {
		nextValues.name = patch.name;
	}

	if (patch.location !== undefined) {
		nextValues.location = patch.location;
	}

	if (patch.role !== undefined) {
		nextValues.role = patch.role;
	}

	if (patch.bio !== undefined) {
		nextValues.bio = patch.bio;
	}

	if (patch.image !== undefined) {
		nextValues.image = patch.image;
	}

	if (patch.backgroundImage !== undefined) {
		nextValues.backgroundImage = patch.backgroundImage;
	}

	const rows = await db
		.update(profilePages)
		.set(nextValues)
		.where(eq(profilePages.userId, userId))
		.returning({
			id: profilePages.id,
			userId: profilePages.userId,
			handle: profilePages.handle,
			name: profilePages.name,
			location: profilePages.location,
			role: profilePages.role,
			bio: profilePages.bio,
			image: profilePages.image,
			backgroundImage: profilePages.backgroundImage,
			updatedAt: profilePages.updatedAt,
		});

	return rows[0] ?? null;
}

export async function createProfilePage(
	db: Database,
	input: ProfilePageCreateInput,
) {
	const values: typeof profilePages.$inferInsert = {
		userId: input.userId,
		handle: input.handle,
		name: input.name,
		updatedAt: new Date(),
	};

	if (input.location !== undefined) {
		values.location = input.location;
	}

	if (input.role !== undefined) {
		values.role = input.role;
	}

	if (input.bio !== undefined) {
		values.bio = input.bio;
	}

	if (input.image !== undefined) {
		values.image = input.image;
	}

	const rows = await db.insert(profilePages).values(values).returning({
		id: profilePages.id,
		userId: profilePages.userId,
		handle: profilePages.handle,
		name: profilePages.name,
		location: profilePages.location,
		role: profilePages.role,
		bio: profilePages.bio,
		image: profilePages.image,
		backgroundImage: profilePages.backgroundImage,
		updatedAt: profilePages.updatedAt,
	});

	return rows[0] ?? null;
}

export async function syncProfileBentoGraph(
	db: Database,
	pageId: string,
	bentos: ProfileBentoSnapshot[],
) {
	await db.transaction(async (tx) => {
		const now = new Date();
		const existingRows = await findProfileRowsByPageId(tx, pageId);
		const publicIdToCanonicalId = new Map<string, string>();
		const existingBentos = buildProfileBentosFromRows(
			existingRows,
			"canonical",
		);

		for (const row of existingRows) {
			if (!row.bentoId) {
				continue;
			}

			const publicId = buildProfileBentoSnapshot(row).id;
			publicIdToCanonicalId.set(publicId, row.bentoId);
		}

		const normalizedIncomingBentos = bentos.map((bento) => ({
			...bento,
			id: publicIdToCanonicalId.get(bento.id) ?? bento.id,
		}));

		if (
			buildProfileBentoGraphSignature(existingBentos) ===
			buildProfileBentoGraphSignature(normalizedIncomingBentos)
		) {
			return;
		}

		const existingById = new Map(
			existingBentos.map((bento) => [bento.id, bento]),
		);
		const incomingById = new Map(
			normalizedIncomingBentos.map((bento) => [bento.id, bento]),
		);
		const deletedBentoIds = existingBentos
			.map((bento) => bento.id)
			.filter((bentoId) => !incomingById.has(bentoId));
		const typeChangedBentoIds = normalizedIncomingBentos
			.filter((bento) => {
				const existing = existingById.get(bento.id);
				return existing !== undefined && existing.type !== bento.type;
			})
			.map((bento) => bento.id);
		const bentoIdsToRemove = Array.from(
			new Set([...deletedBentoIds, ...typeChangedBentoIds]),
		);

		if (bentoIdsToRemove.length > 0) {
			await tx
				.delete(profileLinkBentos)
				.where(inArray(profileLinkBentos.bentoId, bentoIdsToRemove));
			await tx
				.delete(profileTextBentos)
				.where(inArray(profileTextBentos.bentoId, bentoIdsToRemove));
			await tx
				.delete(profileSectionBentos)
				.where(inArray(profileSectionBentos.bentoId, bentoIdsToRemove));
			await tx
				.delete(profileMediaBentos)
				.where(inArray(profileMediaBentos.bentoId, bentoIdsToRemove));
			await tx
				.delete(profileMapBentos)
				.where(inArray(profileMapBentos.bentoId, bentoIdsToRemove));
		}

		if (deletedBentoIds.length > 0) {
			await tx
				.delete(profileBentos)
				.where(
					and(
						eq(profileBentos.profilePageId, pageId),
						inArray(profileBentos.id, deletedBentoIds),
					),
				);
		}

		const bentoRowsToUpsert: Array<{
			id: string;
			profilePageId: string;
			type: ProfileBentoSnapshot["type"];
			updatedAt: Date;
		}> = [];
		const bentoIdsToRecreate = new Set(typeChangedBentoIds);
		const layoutRows: Array<{
			bentoId: string;
			breakpoint: "desktop" | "compact";
			x: number;
			y: number;
			w: number;
			h: number;
			updatedAt: Date;
		}> = [];
		const linkRows: Array<{
			bentoId: string;
			title: string;
			description: string | null;
			favicon: string | null;
			thumbnail: string | null;
			url: string;
			metadata: LinkBentoMetadata | null;
		}> = [];
		const textRows: Array<{
			bentoId: string;
			content: string;
		}> = [];
		const sectionRows: Array<{
			bentoId: string;
			title: string;
		}> = [];
		const mediaRows: Array<{
			bentoId: string;
			mediaType: "image" | "video";
			url: string;
			objectKey: string;
			href: string | null;
			alt: string;
			caption: string;
		}> = [];
		const mapRows: Array<{
			bentoId: string;
			latitude: number;
			longitude: number;
			zoom: number;
			caption: string;
			url: string;
		}> = [];

		for (const bento of normalizedIncomingBentos) {
			const existing = existingById.get(bento.id);
			const bentoSignature = buildProfileBentoGraphSignature([bento]);

			if (!existing) {
				bentoRowsToUpsert.push({
					id: bento.id,
					profilePageId: pageId,
					type: bento.type,
					updatedAt: now,
				});
			} else if (
				buildProfileBentoGraphSignature([existing]) === bentoSignature
			) {
				continue;
			} else if (existing.type !== bento.type) {
				bentoIdsToRecreate.add(bento.id);
				bentoRowsToUpsert.push({
					id: bento.id,
					profilePageId: pageId,
					type: bento.type,
					updatedAt: now,
				});
			} else {
				bentoRowsToUpsert.push({
					id: bento.id,
					profilePageId: pageId,
					type: bento.type,
					updatedAt: now,
				});
			}

			layoutRows.push(
				...Object.entries(bento.layout).map(([breakpoint, layout]) => ({
					bentoId: bento.id,
					breakpoint: breakpoint as "desktop" | "compact",
					x: layout.x,
					y: layout.y,
					w: layout.w,
					h: layout.h,
					updatedAt: now,
				})),
			);

			switch (bento.type) {
				case "link":
					linkRows.push({
						bentoId: bento.id,
						title: bento.content.title,
						description: bento.content.description,
						favicon: bento.content.favicon,
						thumbnail: bento.content.thumbnail,
						url: bento.content.url,
						metadata: bento.content.metadata ?? null,
					});
					break;
				case "text":
					textRows.push({
						bentoId: bento.id,
						content: bento.content.content,
					});
					break;
				case "section":
					sectionRows.push({
						bentoId: bento.id,
						title: bento.content.title,
					});
					break;
				case "media":
					mediaRows.push({
						bentoId: bento.id,
						mediaType: bento.content.mediaType,
						url: bento.content.url,
						objectKey: bento.content.objectKey,
						href: bento.content.href,
						alt: bento.content.alt,
						caption: bento.content.caption,
					});
					break;
				case "map":
					mapRows.push({
						bentoId: bento.id,
						latitude: bento.content.latitude,
						longitude: bento.content.longitude,
						zoom: bento.content.zoom,
						caption: bento.content.caption,
						url: bento.content.url,
					});
					break;
			}
		}

		if (bentoIdsToRecreate.size > 0) {
			await tx
				.delete(profileBentos)
				.where(inArray(profileBentos.id, Array.from(bentoIdsToRecreate)));
		}

		if (bentoRowsToUpsert.length > 0) {
			await tx
				.insert(profileBentos)
				.values(bentoRowsToUpsert)
				.onConflictDoUpdate({
					target: profileBentos.id,
					set: {
						profilePageId: pageId,
						type: sql`excluded."type"`,
						updatedAt: now,
					},
				});
		}

		if (layoutRows.length > 0) {
			await tx
				.insert(profileBentoLayouts)
				.values(layoutRows)
				.onConflictDoUpdate({
					target: [profileBentoLayouts.bentoId, profileBentoLayouts.breakpoint],
					set: {
						x: sql`excluded."x"`,
						y: sql`excluded."y"`,
						w: sql`excluded."w"`,
						h: sql`excluded."h"`,
						updatedAt: now,
					},
				});
		}

		if (linkRows.length > 0) {
			await tx
				.insert(profileLinkBentos)
				.values(linkRows)
				.onConflictDoUpdate({
					target: profileLinkBentos.bentoId,
						set: {
							title: sql`excluded."title"`,
							description: sql`excluded."description"`,
							favicon: sql`excluded."favicon"`,
							thumbnail: sql`excluded."thumbnail"`,
							url: sql`excluded."url"`,
							metadata: sql`excluded."metadata"`,
							updatedAt: now,
						},
					});
		}

		if (textRows.length > 0) {
			await tx
				.insert(profileTextBentos)
				.values(textRows)
				.onConflictDoUpdate({
					target: profileTextBentos.bentoId,
					set: {
						content: sql`excluded."content"`,
						updatedAt: now,
					},
				});
		}

		if (sectionRows.length > 0) {
			await tx
				.insert(profileSectionBentos)
				.values(sectionRows)
				.onConflictDoUpdate({
					target: profileSectionBentos.bentoId,
					set: {
						title: sql`excluded."title"`,
					},
				});
		}

		if (mediaRows.length > 0) {
			await tx
				.insert(profileMediaBentos)
				.values(mediaRows)
				.onConflictDoUpdate({
					target: profileMediaBentos.bentoId,
					set: {
						mediaType: sql`excluded."mediaType"`,
						url: sql`excluded."url"`,
						objectKey: sql`excluded."objectKey"`,
						href: sql`excluded."href"`,
						alt: sql`excluded."alt"`,
						caption: sql`excluded."caption"`,
						updatedAt: now,
					},
				});
		}

		if (mapRows.length > 0) {
			await tx
				.insert(profileMapBentos)
				.values(mapRows)
				.onConflictDoUpdate({
					target: profileMapBentos.bentoId,
					set: {
						latitude: sql`excluded."latitude"`,
						longitude: sql`excluded."longitude"`,
						zoom: sql`excluded."zoom"`,
						caption: sql`excluded."caption"`,
						url: sql`excluded."url"`,
						updatedAt: now,
					},
				});
		}
	});
}

export async function findOwnedProfilePageByUserId(
	db: Database,
	userId: string,
) {
	const page = await findProfilePageByUserId(db, userId);
	return page ? { id: page.id } : null;
}

export async function findOwnedProfileBentoById(
	db: Database,
	bentoId: string,
	userId: string,
) {
	const rows = await db
		.select({
			id: profileBentos.id,
		})
		.from(profileBentos)
		.innerJoin(profilePages, eq(profilePages.id, profileBentos.profilePageId))
		.where(and(eq(profileBentos.id, bentoId), eq(profilePages.userId, userId)))
		.limit(1);

	return rows[0] ?? null;
}

export async function updateProfilePageHandleById(
	db: Database,
	profilePageId: string,
	handle: string,
) {
	const rows = await db
		.update(profilePages)
		.set({
			handle,
			updatedAt: new Date(),
		})
		.where(eq(profilePages.id, profilePageId))
		.returning({
			id: profilePages.id,
			userId: profilePages.userId,
			handle: profilePages.handle,
			name: profilePages.name,
			location: profilePages.location,
			role: profilePages.role,
			bio: profilePages.bio,
			image: profilePages.image,
			backgroundImage: profilePages.backgroundImage,
			updatedAt: profilePages.updatedAt,
		});

	return rows[0] ?? null;
}

export async function updateProfilePageImageByUserId(
	db: Database,
	userId: string,
	imageKind: "profile" | "background",
	imageUrl: string,
) {
	await db
		.update(profilePages)
		.set({
			...(imageKind === "profile"
				? { image: imageUrl }
				: { backgroundImage: imageUrl }),
			updatedAt: new Date(),
		})
		.where(eq(profilePages.userId, userId));
}
