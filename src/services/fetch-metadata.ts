import type { Context } from "hono";
import * as v from "valibot";
import { fetchMetadata as getMetdata } from "../lib/metadata/fetch";
import { parseInputUrl } from "../lib/metadata/url";
import {
	createMetadataCacheStore,
	resolveMetadataWithCache,
} from "../repositories/metadata-cache";
import { metadataResponseSchema } from "../schemas/metadata";
import type { AppBindings } from "../types/app-bindings";
import type { NormalizedMetadata } from "../types/metadata";

export async function fetchMetadata(
	rawUrl: string,
	c: Context<AppBindings>,
): Promise<NormalizedMetadata> {
	const url = parseInputUrl(rawUrl);
	const cacheStore = createMetadataCacheStore(c.env);
	return v.parse(
		metadataResponseSchema,
		await resolveMetadataWithCache(
			url,
			() =>
				getMetdata(url, {
					chzzkClientId: c.env.CHZZK_CLIENT_ID ?? null,
					chzzkClientSecret: c.env.CHZZK_CLIENT_SECRET ?? null,
					githubToken: c.env.GITHUB_TOKEN ?? null,
					twitchClientId: c.env.TWITCH_CLIENT_ID ?? null,
					twitchUserAccessToken: c.env.TWITCH_USER_ACCESS_TOKEN ?? null,
					youtubeApiKey: c.env.YOUTUBE_API_KEY ?? null,
				}),
			cacheStore,
		),
	);
}
