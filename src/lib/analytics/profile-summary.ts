import {
	ANALYTICS_RANGE_KEYS,
	type AnalyticsRangeWindow,
	getAnalyticsRangeWindows,
	getPreviousAnalyticsRangeWindows,
} from "./analytics-ranges";
import { buildProfilePageAnalyticsPath, PROFILE_PAGE_ANALYTICS_EVENT_NAMES } from "./profile";
import type {
	ProfileAnalyticsMetricKey,
	ProfileAnalyticsMetricTotals,
	ProfileAnalyticsResponse,
	ProfileAnalyticsSummary,
	ProfileAnalyticsSummaryMap,
	ProfileAnalyticsTopItem,
} from "../../types/analytics";
import {
	fetchUmamiEventDataValues,
	fetchUmamiEventSeries,
	getUmamiReportingConfig,
	type UmamiReportingConfig,
} from "./umami-client";
import type { AppBindings } from "../../types/app-bindings";

type UmamiSeriesRow = {
	t: string;
	x: string;
	y: number;
};

const roundCtr = (value: number) => Math.round(value);
const roundPercent = (value: number) => Math.round(value * 10) / 10;
const TOP_ITEMS_LIMIT = 5;

const metricKeys = [
	"ctr",
	"linkClicks",
	"pageViews",
] as const satisfies ProfileAnalyticsMetricKey[];

const emptyMetricTotals: ProfileAnalyticsMetricTotals = {
	ctr: 0,
	linkClicks: 0,
	pageViews: 0,
};

const createMetricChange = (current: number, previous: number) => {
	const absolute = current - previous;

	return {
		absolute,
		direction: absolute > 0 ? "up" : absolute < 0 ? "down" : "flat",
		percent:
			previous === 0 ? (current === 0 ? 0 : null) : roundPercent((absolute / previous) * 100),
		previous,
	} as const;
};

const createMetricChanges = (
	current: ProfileAnalyticsMetricTotals,
	previous: ProfileAnalyticsMetricTotals,
) =>
	Object.fromEntries(
		metricKeys.map((metric) => [metric, createMetricChange(current[metric], previous[metric])]),
	) as ProfileAnalyticsSummary["changes"];

export const createEmptyProfileAnalyticsSummary = (
	window: AnalyticsRangeWindow,
	previousWindow?: AnalyticsRangeWindow,
): ProfileAnalyticsSummary => {
	const previous = {
		...(previousWindow ?? window),
		...emptyMetricTotals,
	};

	return {
		...window,
		...emptyMetricTotals,
		changes: createMetricChanges(emptyMetricTotals, emptyMetricTotals),
		previous,
		series: [],
		topItems: [],
	};
};

export const createEmptyProfileAnalyticsSummaryMap = (options?: {
	now?: Date;
	timezone?: string | null;
}): ProfileAnalyticsSummaryMap => {
	const windows = getAnalyticsRangeWindows(options);
	const previousWindows = getPreviousAnalyticsRangeWindows(options);

	return {
		"7d": createEmptyProfileAnalyticsSummary(windows["7d"], previousWindows["7d"]),
		"30d": createEmptyProfileAnalyticsSummary(windows["30d"], previousWindows["30d"]),
		today: createEmptyProfileAnalyticsSummary(windows.today, previousWindows.today),
	};
};

const sumEventRows = (rows: UmamiSeriesRow[], eventName: string) =>
	rows.reduce((total, row) => (row.x === eventName ? total + row.y : total), 0);

const isRowInWindow = (row: UmamiSeriesRow, window: AnalyticsRangeWindow) => {
	const timestamp = Date.parse(row.t);

	return Number.isFinite(timestamp) && timestamp >= window.startAt && timestamp <= window.endAt;
};

const buildMetricTotals = (rows: UmamiSeriesRow[]): ProfileAnalyticsMetricTotals => {
	const pageViews = sumEventRows(rows, PROFILE_PAGE_ANALYTICS_EVENT_NAMES.pageView);
	const linkClicks = sumEventRows(rows, PROFILE_PAGE_ANALYTICS_EVENT_NAMES.linkClick);
	const ctr = pageViews > 0 ? roundCtr((linkClicks / pageViews) * 100) : 0;

	return {
		ctr,
		linkClicks,
		pageViews,
	};
};

const buildSeries = (rows: UmamiSeriesRow[], window: AnalyticsRangeWindow) => {
	const rowsByTimestamp = rows
		.filter((row) => isRowInWindow(row, window))
		.reduce((groups, row) => {
			const timestamp = Date.parse(row.t);

			if (!Number.isFinite(timestamp)) {
				return groups;
			}

			const groupedRows = groups.get(timestamp) ?? [];
			groupedRows.push(row);
			groups.set(timestamp, groupedRows);

			return groups;
		}, new Map<number, UmamiSeriesRow[]>());

	return [...rowsByTimestamp.entries()]
		.sort(([a], [b]) => a - b)
		.map(([timestamp, groupedRows]) => ({
			timestamp,
			...buildMetricTotals(groupedRows),
		}));
};

export const buildProfileAnalyticsSummary = (
	window: AnalyticsRangeWindow,
	rows: UmamiSeriesRow[],
	options?: {
		previousWindow?: AnalyticsRangeWindow;
		topItems?: ProfileAnalyticsTopItem[];
	},
): ProfileAnalyticsSummary => {
	const rowsInWindow = rows.filter((row) => isRowInWindow(row, window));
	const currentTotals = buildMetricTotals(rowsInWindow);
	const previousWindow = options?.previousWindow ?? window;
	const previousTotals = buildMetricTotals(rows.filter((row) => isRowInWindow(row, previousWindow)));

	return {
		...window,
		...currentTotals,
		changes: createMetricChanges(currentTotals, previousTotals),
		previous: {
			...previousWindow,
			...previousTotals,
		},
		series: buildSeries(rows, window),
		topItems: options?.topItems ?? [],
	};
};

const topItemKey = (item: { kind: "link" | "social"; label: string }) =>
	`${item.kind}:${item.label}`;

const fetchTopItemsForWindow = async (options: {
	analyticsPath: string;
	config: Exclude<UmamiReportingConfig, null>;
	endAt: number;
	startAt: number;
}) => {
	const eventRequests = [
		{
			event: PROFILE_PAGE_ANALYTICS_EVENT_NAMES.linkClick,
			kind: "link",
		},
		{
			event: PROFILE_PAGE_ANALYTICS_EVENT_NAMES.socialClick,
			kind: "social",
		},
	] as const;

	const rows = await Promise.all(
		eventRequests.map(async ({ event, kind }) => {
			const values = await fetchUmamiEventDataValues({
				config: options.config,
				endAt: options.endAt,
				event,
				path: options.analyticsPath,
				propertyName: "itemLabel",
				startAt: options.startAt,
			});

			return values.map((value) => ({
				clicks: value.total,
				kind,
				label: value.value,
			}));
		}),
	);

	return rows.flat();
};

const buildTopItems = async (options: {
	analyticsPath: string;
	config: Exclude<UmamiReportingConfig, null>;
	currentWindow: AnalyticsRangeWindow;
	previousWindow: AnalyticsRangeWindow;
}): Promise<ProfileAnalyticsTopItem[]> => {
	const [currentItems, previousItems] = await Promise.all([
		fetchTopItemsForWindow({
			analyticsPath: options.analyticsPath,
			config: options.config,
			endAt: options.currentWindow.endAt,
			startAt: options.currentWindow.startAt,
		}),
		fetchTopItemsForWindow({
			analyticsPath: options.analyticsPath,
			config: options.config,
			endAt: options.previousWindow.endAt,
			startAt: options.previousWindow.startAt,
		}),
	]);

	const previousClicksByItem = new Map(previousItems.map((item) => [topItemKey(item), item.clicks]));
	const totalCurrentClicks = currentItems.reduce((total, item) => total + item.clicks, 0);

	return currentItems
		.sort((a, b) => b.clicks - a.clicks)
		.slice(0, TOP_ITEMS_LIMIT)
		.map((item) => {
			const previousClicks = previousClicksByItem.get(topItemKey(item)) ?? 0;
			const change = item.clicks - previousClicks;

			return {
				change,
				changePercent:
					previousClicks === 0 ? (item.clicks === 0 ? 0 : null) : roundPercent((change / previousClicks) * 100),
				clicks: item.clicks,
				kind: item.kind,
				label: item.label,
				previousClicks,
				share: totalCurrentClicks > 0 ? roundPercent((item.clicks / totalCurrentClicks) * 100) : 0,
			};
		});
};

export const getProfileAnalyticsSummaryMap = async (options: {
	now?: Date;
	profilePageId: string;
	timezone?: string | null;
	config: Exclude<UmamiReportingConfig, null>;
}): Promise<ProfileAnalyticsSummaryMap> => {
	const windows = getAnalyticsRangeWindows(options);
	const previousWindows = getPreviousAnalyticsRangeWindows(options);
	const analyticsPath = buildProfilePageAnalyticsPath(options.profilePageId);
	const daySourceStartAt = previousWindows["30d"].startAt;
	const [dayRows, hourlyRows, topItemsByRange] = await Promise.all([
		fetchUmamiEventSeries({
			config: options.config,
			endAt: windows["30d"].endAt,
			path: analyticsPath,
			startAt: daySourceStartAt,
			timezone: windows["30d"].timezone,
			unit: "day",
		}),
		fetchUmamiEventSeries({
			config: options.config,
			endAt: windows.today.endAt,
			path: analyticsPath,
			startAt: previousWindows.today.startAt,
			timezone: windows.today.timezone,
			unit: "hour",
		}),
		Promise.all(
			ANALYTICS_RANGE_KEYS.map(async (range) => {
				const topItems = await buildTopItems({
					analyticsPath,
					config: options.config,
					currentWindow: windows[range],
					previousWindow: previousWindows[range],
				});

				return [range, topItems] as const;
			}),
		),
	]);
	const topItemsMap = Object.fromEntries(topItemsByRange) as Record<
		(typeof ANALYTICS_RANGE_KEYS)[number],
		ProfileAnalyticsTopItem[]
	>;

	const summaries = ANALYTICS_RANGE_KEYS.map((range) => {
		const window = windows[range];
		const rows = range === "today" ? hourlyRows : dayRows;

		return [
			range,
			buildProfileAnalyticsSummary(window, rows, {
				previousWindow: previousWindows[range],
				topItems: topItemsMap[range],
			}),
		] as const;
	});

	return Object.fromEntries(summaries) as ProfileAnalyticsSummaryMap;
};

export const getProfileAnalyticsResponse = async (options: {
	env: AppBindings["Bindings"];
	now?: Date;
	profilePageId: string | null;
	timezone?: string | null;
}): Promise<ProfileAnalyticsResponse> => {
	const summaries = createEmptyProfileAnalyticsSummaryMap(options);
	const timezone = summaries.today.timezone;
	const config = getUmamiReportingConfig(options.env);

	if (!options.profilePageId) {
		return {
			profilePageId: null,
			state: "no-profile",
			summaries,
			timezone,
		};
	}

	if (!config) {
		return {
			profilePageId: null,
			state: "disabled",
			summaries,
			timezone,
		};
	}

	return {
		profilePageId: options.profilePageId,
		state: "ready",
		summaries: await getProfileAnalyticsSummaryMap({
			config,
			now: options.now,
			profilePageId: options.profilePageId,
			timezone,
		}),
		timezone,
	};
};
