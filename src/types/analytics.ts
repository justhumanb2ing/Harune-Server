import type { AnalyticsRangeKey, AnalyticsRangeWindow } from "../lib/analytics/analytics-ranges";

export type ProfileAnalyticsMetricKey = "ctr" | "linkClicks" | "pageViews";

export type ProfileAnalyticsMetricTotals = {
	ctr: number;
	linkClicks: number;
	pageViews: number;
};

export type ProfileAnalyticsMetricChange = {
	absolute: number;
	direction: "down" | "flat" | "up";
	percent: number | null;
	previous: number;
};

export type ProfileAnalyticsSeriesPoint = ProfileAnalyticsMetricTotals & {
	timestamp: number;
};

export type ProfileAnalyticsTopItem = {
	change: number;
	changePercent: number | null;
	clicks: number;
	kind: "link" | "social";
	label: string;
	previousClicks: number;
	share: number;
};

export type ProfileAnalyticsSummary = AnalyticsRangeWindow &
	ProfileAnalyticsMetricTotals & {
		changes: Record<ProfileAnalyticsMetricKey, ProfileAnalyticsMetricChange>;
		previous: AnalyticsRangeWindow & ProfileAnalyticsMetricTotals;
		series: ProfileAnalyticsSeriesPoint[];
		topItems: ProfileAnalyticsTopItem[];
	};

export type ProfileAnalyticsSummaryMap = Record<AnalyticsRangeKey, ProfileAnalyticsSummary>;

export type ProfileAnalyticsResponse =
	| {
			profilePageId: null;
			state: "disabled";
			summaries: ProfileAnalyticsSummaryMap;
			timezone: string;
	  }
	| {
			profilePageId: null;
			state: "no-profile";
			summaries: ProfileAnalyticsSummaryMap;
			timezone: string;
	  }
	| {
			profilePageId: string;
			state: "ready";
			summaries: ProfileAnalyticsSummaryMap;
			timezone: string;
	  };
