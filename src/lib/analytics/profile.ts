export const PROFILE_PAGE_ANALYTICS_PATH_PREFIX = "/_analytics/profile";

export const PROFILE_PAGE_ANALYTICS_EVENT_NAMES = {
	linkClick: "profile-link-click",
	pageView: "profile-view",
	socialClick: "profile-social-click",
} as const;

export type ProfilePageAnalyticsEventName =
	(typeof PROFILE_PAGE_ANALYTICS_EVENT_NAMES)[keyof typeof PROFILE_PAGE_ANALYTICS_EVENT_NAMES];

export const buildProfilePageAnalyticsPath = (profilePageId: string) =>
	`${PROFILE_PAGE_ANALYTICS_PATH_PREFIX}/${profilePageId}`;
