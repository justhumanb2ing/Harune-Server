import { createMetadataCacheStore, resolveMetadataWithCache } from '../repositories/metadata-cache'
import { fetchMetadata as getMetdata } from '../lib/metadata/fetch'
import { parseInputUrl } from '../lib/metadata/url'
import type { NormalizedMetadata } from '../types/metadata'
import * as v from 'valibot'
import { metadataResponseSchema } from '../schemas/metadata'
import { Context } from 'hono'
import { AppBindings } from '../types/types'

export async function fetchMetadata(
  rawUrl: string,
  c: Context<AppBindings>,
): Promise<NormalizedMetadata> {
  const url = parseInputUrl(rawUrl)
  const cacheStore = createMetadataCacheStore(c.env)
  return v.parse(
    metadataResponseSchema,
    await resolveMetadataWithCache(url, () => getMetdata(url), cacheStore),
  )
}
