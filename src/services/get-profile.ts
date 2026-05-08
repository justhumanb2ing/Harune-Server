import { HTTPException } from "hono/http-exception";

import type { Database } from "../lib/db";
import {
	buildProfileBentosFromRows,
	findProfileRowsByHandle,
} from "../repositories/profile-repository";
import type { ProfileResponse } from "../types/profile";

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
	const bento = buildProfileBentosFromRows(rows);
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
