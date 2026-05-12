import * as v from 'valibot'
import type {
  MetadataErrorCode,
  MetadataErrorDetails,
} from '../types/metadata'

export const metadataQuerySchema = v.object({
  url: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('url is required'),
  )
})

export const metadataResponseSchema = v.object({
  url: v.pipe(v.string(), v.url()),
  canonicalUrl: v.nullable(v.pipe(v.string(), v.url())),
  title: v.nullable(v.string()),
  description: v.nullable(v.string()),
  image: v.nullable(v.pipe(v.string(), v.url())),
  siteName: v.nullable(v.string()),
  favicon: v.nullable(v.pipe(v.string(), v.url())),
  provider: v.nullable(v.string()),
  providerMetadata: v.nullable(
    v.object({
      provider: v.string(),
      viewType: v.string(),
      fetchedAt: v.string(),
      payload: v.record(v.string(), v.unknown()),
    }),
  ),
})

const metadataErrorCodeSchema = v.picklist([
  'missing_url',
  'invalid_url',
  'invalid_protocol',
  'blocked_host',
  'fetch_failed',
  'not_found',
  'internal_error',
])

export const metadataErrorSchema = v.object({
  error: metadataErrorCodeSchema,
  message: v.string(),
  details: v.optional(
    v.record(
      v.string(),
      v.union([v.string(), v.number(), v.boolean(), v.null_()]),
    ),
  ),
})

export type MetadataErrorInput = {
  error?: MetadataErrorCode
  details?: MetadataErrorDetails
}
