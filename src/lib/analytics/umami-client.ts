import { buildProfilePageAnalyticsPath, PROFILE_PAGE_ANALYTICS_EVENT_NAMES } from "./profile";
import type { AppBindings } from "../../types/app-bindings";

const UMAMI_CLOUD_API_ENDPOINT = "https://api.umami.is/v1";
const UMAMI_CLOUD_SCRIPT_HOST = "cloud.umami.is";
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

export type UmamiReportingConfig = {
	apiEndpoint: string;
	authHeaderName: string;
	authHeaderValue: string;
	websiteId: string;
} | null;

type UmamiEventSeriesRow = {
	t: string;
	x: string;
	y: number;
};

type UmamiEventDataValueRow = {
	total: number;
	value: string;
};

const deriveSelfHostedApiEndpoint = (scriptSrc?: string) => {
	if (!scriptSrc) {
		return null;
	}

	try {
		const scriptUrl = new URL(scriptSrc);

		if (scriptUrl.hostname === UMAMI_CLOUD_SCRIPT_HOST) {
			return UMAMI_CLOUD_API_ENDPOINT;
		}

		return `${scriptUrl.origin}/api`;
	} catch {
		return null;
	}
};

export const getUmamiReportingConfig = (env: AppBindings["Bindings"]): UmamiReportingConfig => {
	const websiteId = env.UMAMI_WEBSITE_ID;

	if (!websiteId) {
		return null;
	}

	if (env.UMAMI_API_KEY) {
		return {
			apiEndpoint: env.UMAMI_API_ENDPOINT || UMAMI_CLOUD_API_ENDPOINT,
			authHeaderName: "x-umami-api-key",
			authHeaderValue: env.UMAMI_API_KEY,
			websiteId,
		};
	}

	if (env.UMAMI_API_TOKEN) {
		const apiEndpoint = env.UMAMI_API_ENDPOINT || deriveSelfHostedApiEndpoint(env.UMAMI_SCRIPT_SRC);

		if (!apiEndpoint) {
			return null;
		}

		return {
			apiEndpoint,
			authHeaderName: "authorization",
			authHeaderValue: `Bearer ${env.UMAMI_API_TOKEN}`,
			websiteId,
		};
	}

	return null;
};

type FetchUmamiEventSeriesParams = {
	config: Exclude<UmamiReportingConfig, null>;
	endAt: number;
	path: string;
	startAt: number;
	timezone: string;
	unit: "day" | "hour";
};

export const fetchUmamiEventSeries = async ({
	config,
	endAt,
	path,
	startAt,
	timezone,
	unit,
}: FetchUmamiEventSeriesParams): Promise<UmamiEventSeriesRow[]> => {
	const url = new URL(`${config.apiEndpoint}/websites/${config.websiteId}/events/series`);
	url.searchParams.set("endAt", String(endAt));
	url.searchParams.set("filters", JSON.stringify({ path }));
	url.searchParams.set("path", path);
	url.searchParams.set("startAt", String(startAt));
	url.searchParams.set("timezone", timezone);
	url.searchParams.set("unit", unit);
	url.searchParams.set("url", path);

	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			[config.authHeaderName]: config.authHeaderValue,
		},
	});

	if (!response.ok) {
		throw new Error(`Umami request failed with status ${response.status}`);
	}

	const data = (await response.json()) as unknown;

	if (!Array.isArray(data)) {
		return [];
	}

	return data.filter(
		(row): row is UmamiEventSeriesRow =>
			typeof row === "object" &&
			row !== null &&
			typeof (row as UmamiEventSeriesRow).x === "string" &&
			typeof (row as UmamiEventSeriesRow).y === "number" &&
			typeof (row as UmamiEventSeriesRow).t === "string",
	);
};

type FetchUmamiEventDataValuesParams = {
	config: Exclude<UmamiReportingConfig, null>;
	endAt: number;
	event: string;
	path: string;
	propertyName: string;
	startAt: number;
};

export const fetchUmamiEventDataValues = async ({
	config,
	endAt,
	event,
	path,
	propertyName,
	startAt,
}: FetchUmamiEventDataValuesParams): Promise<UmamiEventDataValueRow[]> => {
	const url = new URL(`${config.apiEndpoint}/websites/${config.websiteId}/event-data/values`);
	url.searchParams.set("endAt", String(endAt));
	url.searchParams.set("event", event);
	url.searchParams.set("filters", JSON.stringify({ path }));
	url.searchParams.set("path", path);
	url.searchParams.set("propertyName", propertyName);
	url.searchParams.set("startAt", String(startAt));
	url.searchParams.set("url", path);

	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			[config.authHeaderName]: config.authHeaderValue,
		},
	});

	if (!response.ok) {
		throw new Error(`Umami request failed with status ${response.status}`);
	}

	const data = (await response.json()) as unknown;

	if (!Array.isArray(data)) {
		return [];
	}

	return data.filter(
		(row): row is UmamiEventDataValueRow =>
			typeof row === "object" &&
			row !== null &&
			typeof (row as UmamiEventDataValueRow).total === "number" &&
			typeof (row as UmamiEventDataValueRow).value === "string",
	);
};

export const profileAnalyticsPathFor = (profilePageId: string) =>
	buildProfilePageAnalyticsPath(profilePageId);

export const profileAnalyticsEventNames = PROFILE_PAGE_ANALYTICS_EVENT_NAMES;
