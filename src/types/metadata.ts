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
		| ChzzkChannelMetadata
		| TwitchChannelMetadata
		| DiscordInviteMetadata
		| YoutubeChannelMetadata
		| YoutubeVideoMetadata
		| SpotifyOEmbedMetadata
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

export type SpotifyOEmbedMetadata = ProviderMetadata & {
	provider: "spotify";
	viewType: "spotify_oembed";
	payload: {
		title: string | null;
		html: string | null;
		width: number | null;
		height: number | null;
		version: string | null;
		providerName: string | null;
		providerUrl: string | null;
		type: string | null;
		thumbnailUrl: string | null;
		thumbnailWidth: number | null;
		thumbnailHeight: number | null;
	};
};

export type ChzzkChannelMetadata = ProviderMetadata & {
	provider: "chzzk";
	viewType: "chzzk_channel";
	payload: {
		channelId: string;
		channelName: string | null;
		channelImageUrl: string | null;
		followerCount: number | null;
		verifiedMark: boolean | null;
	};
};

export type TwitchChannelMetadata = ProviderMetadata & {
	provider: "twitch";
	viewType: "twitch_channel";
	payload: {
		broadcasterId: string;
		broadcasterLogin: string;
		broadcasterName: string | null;
		displayName: string | null;
		description: string | null;
		profileImageUrl: string | null;
		offlineImageUrl: string | null;
		followerCount: number | null;
		viewCount: number | null;
	};
};

export type DiscordInviteMetadata = ProviderMetadata & {
	provider: "discord";
	viewType: "discord_invite";
	payload: {
		code: string;
		guildId: string | null;
		guildName: string | null;
		guildDescription: string | null;
		iconUrl: string | null;
		memberCount: number | null;
		presenceCount: number | null;
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

export type YoutubeVideoMetadata = ProviderMetadata & {
	provider: "youtube";
	viewType: "youtube_video";
	payload: {
		videoId: string;
		channelId: string | null;
		channelTitle: string | null;
		snippet: Record<string, unknown>;
		statistics: Record<string, unknown>;
		player: Record<string, unknown>;
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
