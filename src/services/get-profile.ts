import { HTTPException } from "hono/http-exception";

import { Database } from "../lib/db";
import { findProfileRowsByHandle } from "../repositories/profile-repository";
import type {
  ProfileBentoItem,
  ProfileResponse,
} from "../types/profile";

type ViewerInput = {
  userId: string | null;
};

type ProfileRow = Awaited<ReturnType<typeof findProfileRowsByHandle>>[number];

export async function getProfile(
  db: Database,
  handle: string,
  viewer: ViewerInput,
): Promise<ProfileResponse> {
  const rows = await findProfileRowsByHandle(db, handle);

  if (rows.length === 0) {
    throw new HTTPException(404, {
      message: "profile not found",
      cause: { error: "profile_not_found" },
    });
  }

  const page = buildPage(rows[0]);
  const bento = buildBentos(rows);
  const viewerUserId = viewer.userId;

  return {
    page,
    bento,
    viewer: {
      isAuthenticated: viewerUserId !== null,
      userId: viewerUserId,
      canEdit: viewerUserId !== null && viewerUserId === page.userId,
    },
  };
}

function buildPage(row: ProfileRow): ProfileResponse["page"] {
  return {
    id: row.pageId,
    userId: row.pageUserId,
    handle: row.pageHandle,
    name: row.pageName,
    role: row.pageRole,
    bio: row.pageBio,
    image: row.pageImage,
    backgroundImage: row.pageBackgroundImage,
    location: row.pageLocation,
    updatedAt: row.pageUpdatedAt.toISOString(),
  };
}

function buildBentos(rows: ProfileRow[]): ProfileBentoItem[] {
  const bentos = new Map<string, ProfileBentoItem>();

  for (const row of rows) {
    if (!row.bentoId) {
      continue;
    }

    if (!bentos.has(row.bentoId)) {
      bentos.set(row.bentoId, buildBento(row));
    }
  }

  return Array.from(bentos.values());
}

function buildBento(row: ProfileRow): ProfileBentoItem {
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
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
      y: requireValue(
        row.desktopLayoutY,
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
      w: requireValue(
        row.desktopLayoutW,
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
      h: requireValue(
        row.desktopLayoutH,
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
    },
    compact: {
      x: requireValue(
        row.compactLayoutX,
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
      y: requireValue(
        row.compactLayoutY,
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
      w: requireValue(
        row.compactLayoutW,
        "profile_layout_missing",
        `profile bento ${row.bentoId} is missing required layouts`,
      ),
      h: requireValue(
        row.compactLayoutH,
        "profile_layout_missing",
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
        id: row.linkBentoId,
        type: "link",
        layout,
        content: {
          title: requireValue(
            row.linkTitle,
            "profile_link_bento_missing",
            `profile link bento ${row.bentoId} is missing content`,
          ),
          description: row.linkDescription,
          favicon: row.linkFavicon,
          thumbnail: row.linkThumbnail,
          url: requireValue(
            row.linkUrl,
            "profile_link_bento_missing",
            `profile link bento ${row.bentoId} is missing content`,
          ),
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
        id: row.textBentoId,
        type: "text",
        layout,
        content: {
          content: requireValue(
            row.textContent,
            "profile_text_bento_missing",
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
        id: row.sectionBentoId,
        type: "section",
        layout,
        content: {
          title: requireValue(
            row.sectionTitle,
            "profile_section_bento_missing",
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
        id: row.mediaBentoId,
        type: "media",
        layout,
        content: {
          mediaType: requireValue(
            row.mediaType,
            "profile_media_bento_missing",
            `profile media bento ${row.bentoId} is missing content`,
          ),
          url: requireValue(
            row.mediaUrl,
            "profile_media_bento_missing",
            `profile media bento ${row.bentoId} is missing content`,
          ),
          objectKey: requireValue(
            row.mediaObjectKey,
            "profile_media_bento_missing",
            `profile media bento ${row.bentoId} is missing content`,
          ),
          href: row.mediaHref,
          alt: requireValue(
            row.mediaAlt,
            "profile_media_bento_missing",
            `profile media bento ${row.bentoId} is missing content`,
          ),
          caption: requireValue(
            row.mediaCaption,
            "profile_media_bento_missing",
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
        id: row.mapBentoId,
        type: "map",
        layout,
        content: {
          latitude: requireValue(
            row.mapLatitude,
            "profile_map_bento_missing",
            `profile map bento ${row.bentoId} is missing content`,
          ),
          longitude: requireValue(
            row.mapLongitude,
            "profile_map_bento_missing",
            `profile map bento ${row.bentoId} is missing content`,
          ),
          zoom: requireValue(
            row.mapZoom,
            "profile_map_bento_missing",
            `profile map bento ${row.bentoId} is missing content`,
          ),
          caption: requireValue(
            row.mapCaption,
            "profile_map_bento_missing",
            `profile map bento ${row.bentoId} is missing content`,
          ),
          url: requireValue(
            row.mapUrl,
            "profile_map_bento_missing",
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

function profileInvariantError(error: string, message: string): HTTPException {
  return new HTTPException(500, {
    message,
    cause: { error },
  });
}

function requireValue<T>(
  value: T | null | undefined,
  error: string,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw profileInvariantError(error, message);
  }

  return value;
}
