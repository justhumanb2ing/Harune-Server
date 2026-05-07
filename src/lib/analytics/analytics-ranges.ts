export const ANALYTICS_RANGE_KEYS = ["today", "7d", "30d"] as const;

export type AnalyticsRangeKey = (typeof ANALYTICS_RANGE_KEYS)[number];

export type AnalyticsRangeWindow = {
	endAt: number;
	label: string;
	startAt: number;
	timezone: string;
	unit: "day" | "hour";
};

const DEFAULT_TIMEZONE = "UTC";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateTimeFormatter = (timeZone: string) => {
	const cached = formatterCache.get(timeZone);

	if (cached) {
		return cached;
	}

	const formatter = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
	});

	formatterCache.set(timeZone, formatter);

	return formatter;
};

const getDateTimeParts = (date: Date, timeZone: string) => {
	const formatter = getDateTimeFormatter(timeZone);
	const parts = formatter.formatToParts(date);

	const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));

	return {
		day: Number(lookup.day),
		hour: Number(lookup.hour),
		minute: Number(lookup.minute),
		month: Number(lookup.month),
		second: Number(lookup.second),
		year: Number(lookup.year),
	};
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
	const parts = getDateTimeParts(date, timeZone);
	const zonedDateAsUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);

	return zonedDateAsUtc - date.getTime();
};

const zonedDateTimeToUtcMs = (
	parts: {
		day: number;
		hour: number;
		minute: number;
		month: number;
		second: number;
		year: number;
	},
	timeZone: string,
) => {
	const utcGuess = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);
	const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);

	return utcGuess - offset;
};

const getStartOfTodayUtcMs = (date: Date, timeZone: string) => {
	const parts = getDateTimeParts(date, timeZone);

	return zonedDateTimeToUtcMs(
		{
			day: parts.day,
			hour: 0,
			minute: 0,
			month: parts.month,
			second: 0,
			year: parts.year,
		},
		timeZone,
	);
};

export const isValidAnalyticsTimezone = (timeZone: string) => {
	try {
		Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
		return true;
	} catch {
		return false;
	}
};

export const normalizeAnalyticsTimezone = (timeZone?: string | null) => {
	if (timeZone && isValidAnalyticsTimezone(timeZone)) {
		return timeZone;
	}

	return DEFAULT_TIMEZONE;
};

export const getAnalyticsRangeWindow = (
	range: AnalyticsRangeKey,
	options?: {
		now?: Date;
		timezone?: string | null;
	},
): AnalyticsRangeWindow => {
	const now = options?.now ?? new Date();
	const timezone = normalizeAnalyticsTimezone(options?.timezone);
	const endAt = now.getTime();

	if (range === "today") {
		return {
			endAt,
			label: "Today",
			startAt: getStartOfTodayUtcMs(now, timezone),
			timezone,
			unit: "hour",
		};
	}

	if (range === "7d") {
		return {
			endAt,
			label: "7d",
			startAt: endAt - ONE_DAY_MS * 7,
			timezone,
			unit: "day",
		};
	}

	return {
		endAt,
		label: "30d",
		startAt: endAt - ONE_DAY_MS * 30,
		timezone,
		unit: "day",
	};
};

export const getPreviousAnalyticsRangeWindow = (
	range: AnalyticsRangeKey,
	options?: {
		now?: Date;
		timezone?: string | null;
	},
): AnalyticsRangeWindow => {
	const window = getAnalyticsRangeWindow(range, options);

	if (range === "today") {
		return {
			...window,
			endAt: window.endAt - ONE_DAY_MS,
			label: "Yesterday",
			startAt: window.startAt - ONE_DAY_MS,
		};
	}

	const duration = window.endAt - window.startAt;

	return {
		...window,
		endAt: window.startAt - 1,
		label: `Previous ${window.label}`,
		startAt: window.startAt - duration,
	};
};

export const getAnalyticsRangeWindows = (options?: {
	now?: Date;
	timezone?: string | null;
}): Record<AnalyticsRangeKey, AnalyticsRangeWindow> => ({
	"7d": getAnalyticsRangeWindow("7d", options),
	"30d": getAnalyticsRangeWindow("30d", options),
	today: getAnalyticsRangeWindow("today", options),
});

export const getPreviousAnalyticsRangeWindows = (options?: {
	now?: Date;
	timezone?: string | null;
}): Record<AnalyticsRangeKey, AnalyticsRangeWindow> => ({
	"7d": getPreviousAnalyticsRangeWindow("7d", options),
	"30d": getPreviousAnalyticsRangeWindow("30d", options),
	today: getPreviousAnalyticsRangeWindow("today", options),
});
