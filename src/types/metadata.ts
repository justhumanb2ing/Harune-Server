export type NormalizedMetadata = {
  url: string
  canonicalUrl: string | null
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

export type MetadataErrorDetails = Record<string, string | number | boolean | null>

export type MetadataErrorCode =
  | 'missing_url'
  | 'invalid_url'
  | 'invalid_protocol'
  | 'blocked_host'
  | 'fetch_failed'
  | 'not_found'
  | 'internal_error'

export type MetadataErrorResponse = {
  error: MetadataErrorCode
  message: string
  details?: MetadataErrorDetails
}

export type MetadataCause = {
  error?: MetadataErrorCode
  [key: string]: string | number | boolean | null | undefined
}

export type ImageCandidate = {
  url: string
  width: number | null
  height: number | null
  order: number
  source: 'og' | 'twitter'
}

export type IconCandidate = {
  url: string
  score: number
  order: number
}
