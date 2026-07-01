import type { ProfileAnalyticsResponse } from "../../types/analytics";
import type { AppBindings } from "../../types/app-bindings";

import { getAnalyticsRangeWindow } from "./analytics-ranges";
import { buildProfilePageAnalyticsPath } from "./profile";
import {
	fetchUmamiWebsiteStats,
	getUmamiReportingConfig,
} from "./umami-client";

export const getProfileAnalyticsResponse = async (options: {
	env: AppBindings["Bindings"];
	now?: Date;
	profilePageId: string | null;
	timezone?: string | null;
}): Promise<ProfileAnalyticsResponse> => {
	if (!options.profilePageId) {
		return { visitors: 0 };
	}

	const config = getUmamiReportingConfig(options.env);

	if (!config) {
		return { visitors: 0 };
	}

	const todayWindow = getAnalyticsRangeWindow("today", {
		now: options.now,
		timezone: options.timezone,
	});
	const stats = await fetchUmamiWebsiteStats({
		config,
		endAt: todayWindow.endAt,
		path: buildProfilePageAnalyticsPath(options.profilePageId),
		startAt: todayWindow.startAt,
	}).catch(() => ({ visitors: 0 }));

	return { visitors: stats.visitors };
};
