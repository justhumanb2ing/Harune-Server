export type NormalizedMetadata = {
	url: string;
	domain: string;
	title: string | null;
	description: string | null;
	image: string | null;
	siteName: string | null;
	favicon: string | null;
	provider: string | null;
	providerMetadata:
		| ProviderMetadata
		| GithubContributionMetadata
		| YoutubeChannelMetadata
		| null;
};

export type ProviderMetadata = {
	provider: string;
	viewType: string;
	fetchedAt: string;
	payload: Record<string, unknown>;
};

export type YoutubeChannelMetadata = ProviderMetadata & {
	provider: "youtube";
	viewType: "youtube_channel";
	payload: {
		snippet: Record<string, unknown>;
		statistics: Record<string, unknown>;
	};
};

export type GithubContributionDay = {
	date: string;
	contributionCount: number;
	contributionLevel: string;
	color: string;
	weekday: number;
};

export type GithubContributionMetadata = ProviderMetadata & {
	provider: "github";
	viewType: "github_contributions_60d";
	payload: {
		login: string;
		name: string | null;
		avatarUrl: string | null;
		profileUrl: string;
		rangeStart: string;
		rangeEnd: string;
		totalContributions: number;
		days: GithubContributionDay[];
	};
};

export type MetadataErrorDetails = Record<
	string,
	string | number | boolean | null
>;

export type MetadataErrorCode =
	| "missing_url"
	| "invalid_url"
	| "invalid_protocol"
	| "blocked_host"
	| "fetch_failed"
	| "not_found"
	| "internal_error";

export type MetadataErrorResponse = {
	error: MetadataErrorCode;
	message: string;
	details?: MetadataErrorDetails;
};

export type MetadataCause = {
	error?: MetadataErrorCode;
	[key: string]: string | number | boolean | null | undefined;
};

export type ImageCandidate = {
	url: string;
	width: number | null;
	height: number | null;
	order: number;
	source: "og" | "twitter";
};

export type IconCandidate = {
	url: string;
	score: number;
	order: number;
};
