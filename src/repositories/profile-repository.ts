import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
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
	linkBlockPosition: number;
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
			linkBlockPosition: profilePages.linkBlockPosition,
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

	await db
		.update(profilePages)
		.set(nextValues)
		.where(eq(profilePages.userId, userId));
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

	await db.insert(profilePages).values(values);
}

export async function syncProfileBentoGraph(
	db: Database,
	pageId: string,
	bentos: ProfileBentoSnapshot[],
) {
	await db.transaction(async (tx) => {
		const now = new Date();
		const bentoIds = bentos.map((bento) => bento.id);

		if (bentoIds.length === 0) {
			await tx
				.delete(profileBentos)
				.where(eq(profileBentos.profilePageId, pageId));
			return;
		}

		await tx
			.delete(profileBentos)
			.where(
				and(
					eq(profileBentos.profilePageId, pageId),
					notInArray(profileBentos.id, bentoIds),
				),
			);

		await tx
			.insert(profileBentos)
			.values(
				bentos.map((bento) => ({
					id: bento.id,
					profilePageId: pageId,
					type: bento.type,
					updatedAt: now,
				})),
			)
			.onConflictDoUpdate({
				target: profileBentos.id,
				set: {
					profilePageId: pageId,
					type: sql`excluded."type"`,
					updatedAt: now,
				},
			});

		await tx
			.insert(profileBentoLayouts)
			.values(
				bentos.flatMap((bento) =>
					Object.entries(bento.layout).map(([breakpoint, layout]) => ({
						bentoId: bento.id,
						breakpoint: breakpoint as "desktop" | "compact",
						x: layout.x,
						y: layout.y,
						w: layout.w,
						h: layout.h,
						updatedAt: now,
					})),
				),
			)
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

		const linkRows = bentos
			.filter((bento) => bento.type === "link")
			.map((bento) => ({
				bentoId: bento.id,
				title: bento.content.title,
				description: bento.content.description,
				favicon: bento.content.favicon,
				thumbnail: bento.content.thumbnail,
				url: bento.content.url,
			}));

		const textRows = bentos
			.filter((bento) => bento.type === "text")
			.map((bento) => ({
				bentoId: bento.id,
				content: bento.content.content,
			}));

		const sectionRows = bentos
			.filter((bento) => bento.type === "section")
			.map((bento) => ({
				bentoId: bento.id,
				title: bento.content.title,
			}));

		const mediaRows = bentos
			.filter((bento) => bento.type === "media")
			.map((bento) => ({
				bentoId: bento.id,
				mediaType: bento.content.mediaType,
				url: bento.content.url,
				objectKey: bento.content.objectKey,
				href: bento.content.href,
				alt: bento.content.alt,
				caption: bento.content.caption,
			}));

		const mapRows = bentos
			.filter((bento) => bento.type === "map")
			.map((bento) => ({
				bentoId: bento.id,
				latitude: bento.content.latitude,
				longitude: bento.content.longitude,
				zoom: bento.content.zoom,
				caption: bento.content.caption,
				url: bento.content.url,
			}));

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
	await db
		.update(profilePages)
		.set({
			handle,
			updatedAt: new Date(),
		})
		.where(eq(profilePages.id, profilePageId));
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
