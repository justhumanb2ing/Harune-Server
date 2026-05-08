import { and, asc, desc, eq } from "drizzle-orm";
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
  image: string | null;
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
      image: profilePages.image,
    })
    .from(profilePages)
    .where(eq(profilePages.userId, userId))
    .orderBy(desc(profilePages.updatedAt), desc(profilePages.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function findOwnedProfilePageByUserId(db: Database, userId: string) {
  const page = await findProfilePageByUserId(db, userId);
  return page ? { id: page.id } : null;
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
