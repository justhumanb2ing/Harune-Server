import type { Database } from "../lib/db";
import { findOwnedProfilePageByUserId } from "../repositories/profile-repository";
import { getProfileAnalyticsResponse } from "../lib/analytics/profile-summary";
import type { AppBindings } from "../types/app-bindings";
import type { ProfileAnalyticsResponse } from "../types/analytics";

type GetAnalyticsDependencies = {
	findOwnedProfilePageByUserId?: typeof findOwnedProfilePageByUserId;
	getProfileAnalyticsResponse?: typeof getProfileAnalyticsResponse;
};

export async function getAnalytics(
	db: Database,
	userId: string,
	options: {
		env: AppBindings["Bindings"];
		timezoneHeader?: string | null;
		now?: Date;
	},
	dependencies: GetAnalyticsDependencies = {},
): Promise<ProfileAnalyticsResponse> {
	const findOwnedProfilePage =
		dependencies.findOwnedProfilePageByUserId ?? findOwnedProfilePageByUserId;
	const getAnalyticsResponse =
		dependencies.getProfileAnalyticsResponse ?? getProfileAnalyticsResponse;
	const profilePage = await findOwnedProfilePage(db, userId);

	return getAnalyticsResponse({
		env: options.env,
		now: options.now,
		profilePageId: profilePage?.id ?? null,
		timezone: options.timezoneHeader,
	});
}
