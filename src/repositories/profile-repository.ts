import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { Database } from "../lib/db";
import {
  profileBentoLayouts,
  profileBentos,
  profileLinkBentos,
  profileMediaBentos,
  profileMapBentos,
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

export type ProfilePagePatch = {
  name?: string | null;
  location?: string | null;
  role?: string | null;
  bio?: string | null;
  image?: string | null;
  backgroundImage?: string | null;
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

type ProfileBentoLayoutRow = {
  id: string | null;
  breakpoint: "desktop" | "compact" | null;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
};

type ProfileBentoRow = {
  pageId: string;
  bentoId: string | null;
  bentoType: "link" | "text" | "section" | "media" | "map" | null;
  desktopLayout: ProfileBentoLayoutRow;
  compactLayout: ProfileBentoLayoutRow;
  link: {
    id: string | null;
    title: string | null;
    description: string | null;
    favicon: string | null;
    thumbnail: string | null;
    url: string | null;
  };
  text: {
    id: string | null;
    content: string | null;
  };
  section: {
    id: string | null;
    title: string | null;
  };
  media: {
    id: string | null;
    mediaType: "image" | "video" | null;
    url: string | null;
    objectKey: string | null;
    href: string | null;
    alt: string | null;
    caption: string | null;
  };
  map: {
    id: string | null;
    latitude: number | null;
    longitude: number | null;
    zoom: number | null;
    caption: string | null;
    url: string | null;
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
      and(eq(profileLinkBentos.bentoId, profileBentos.id), eq(profileBentos.type, "link")),
    )
    .leftJoin(
      profileTextBentos,
      and(eq(profileTextBentos.bentoId, profileBentos.id), eq(profileBentos.type, "text")),
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
      and(eq(profileMediaBentos.bentoId, profileBentos.id), eq(profileBentos.type, "media")),
    )
    .leftJoin(
      profileMapBentos,
      and(eq(profileMapBentos.bentoId, profileBentos.id), eq(profileBentos.type, "map")),
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
      and(eq(profileLinkBentos.bentoId, profileBentos.id), eq(profileBentos.type, "link")),
    )
    .leftJoin(
      profileTextBentos,
      and(eq(profileTextBentos.bentoId, profileBentos.id), eq(profileBentos.type, "text")),
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
      and(eq(profileMediaBentos.bentoId, profileBentos.id), eq(profileBentos.type, "media")),
    )
    .leftJoin(
      profileMapBentos,
      and(eq(profileMapBentos.bentoId, profileBentos.id), eq(profileBentos.type, "map")),
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

export async function syncProfileBentoGraph(
  db: Database,
  pageId: string,
  bentos: ProfileBentoSnapshot[],
) {
  await db.transaction(async (tx) => {
    const existingRows = await findProfileRowsByPageId(tx, pageId);
    const existingIds = new Set(existingRows.flatMap((row) => (row.bentoId ? [row.bentoId] : [])));
    const nextIds = new Set(bentos.map((bento) => bento.id));
    const removedIds = Array.from(existingIds).filter((bentoId) => !nextIds.has(bentoId));

    if (removedIds.length > 0) {
      await tx.delete(profileBentos).where(inArray(profileBentos.id, removedIds));
    }

    for (const bento of bentos) {
      await tx
        .insert(profileBentos)
        .values({
          id: bento.id,
          profilePageId: pageId,
          type: bento.type,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: profileBentos.id,
          set: {
            profilePageId: pageId,
            type: bento.type,
            updatedAt: new Date(),
          },
        });

      await tx.delete(profileLinkBentos).where(eq(profileLinkBentos.bentoId, bento.id));
      await tx.delete(profileTextBentos).where(eq(profileTextBentos.bentoId, bento.id));
      await tx.delete(profileSectionBentos).where(eq(profileSectionBentos.bentoId, bento.id));
      await tx.delete(profileMediaBentos).where(eq(profileMediaBentos.bentoId, bento.id));
      await tx.delete(profileMapBentos).where(eq(profileMapBentos.bentoId, bento.id));
      await tx.delete(profileBentoLayouts).where(eq(profileBentoLayouts.bentoId, bento.id));

      await tx
        .insert(profileBentoLayouts)
        .values(
          Object.entries(bento.layout).map(([breakpoint, layout]) => ({
            bentoId: bento.id,
            breakpoint: breakpoint as "desktop" | "compact",
            x: layout.x,
            y: layout.y,
            w: layout.w,
            h: layout.h,
            updatedAt: new Date(),
          })),
        )
        .onConflictDoNothing();

      switch (bento.type) {
        case "link":
          await tx.insert(profileLinkBentos).values({
            bentoId: bento.id,
            title: bento.content.title,
            description: bento.content.description,
            favicon: bento.content.favicon,
            thumbnail: bento.content.thumbnail,
            url: bento.content.url,
          });
          break;
        case "text":
          await tx.insert(profileTextBentos).values({
            bentoId: bento.id,
            content: bento.content.content,
          });
          break;
        case "section":
          await tx.insert(profileSectionBentos).values({
            bentoId: bento.id,
            title: bento.content.title,
          });
          break;
        case "media":
          await tx.insert(profileMediaBentos).values({
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
          await tx.insert(profileMapBentos).values({
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
  });
}

export async function findOwnedProfilePageByUserId(db: Database, userId: string) {
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
