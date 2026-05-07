import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import * as v from 'valibot'
import { metadataErrorSchema, type MetadataErrorInput } from '../../schemas/metadata'
import type { MetadataErrorCode } from '../../types/metadata'
import type { AppBindings } from '../../types/types'

type MetadataContext = Pick<Context<AppBindings>, 'json'>
type MetadataErrorBody = v.InferOutput<typeof metadataErrorSchema>
type MetadataErrorStatus = 400 | 401 | 403 | 404 | 500 | 502

export function metadataErrorResponse(
  c: MetadataContext,
  status: MetadataErrorStatus,
  input: MetadataErrorInput & { error: MetadataErrorCode; message: string },
) {
  const body = v.parse(metadataErrorSchema, {
    error: input.error,
    message: input.message,
    ...(input.details ? { details: input.details } : {}),
  } satisfies MetadataErrorBody)

  return c.json(body, status)
}

export function missingUrl(
  c: MetadataContext,
  message = 'url query parameter is required',
) {
  return metadataErrorResponse(c, 400, {
    error: 'missing_url',
    message,
  })
}

export function metadataUrlValidationErrorResponse(
  c: MetadataContext,
  error: unknown,
) {
  if (!(error instanceof HTTPException) || error.status !== 400) {
    return null
  }

  const cause = error.cause
  if (!cause || typeof cause !== 'object') {
    return null
  }

  const details = cause as Record<string, unknown>
  const code = details.error
  if (code === 'invalid_url') {
    return metadataErrorResponse(c, 400, {
      error: 'invalid_url',
      message: 'url must be a valid absolute URL',
      details: pickMetadataDetails(details, ['rawUrl']),
    })
  }

  if (code === 'invalid_protocol') {
    return metadataErrorResponse(c, 400, {
      error: 'invalid_protocol',
      message: 'url must use http or https',
      details: pickMetadataDetails(details, ['protocol']),
    })
  }

  if (code === 'blocked_host') {
    return metadataErrorResponse(c, 400, {
      error: 'blocked_host',
      message: 'url points to a blocked host',
      details: pickMetadataDetails(details, ['hostname']),
    })
  }

  return null
}

function pickMetadataDetails(
  details: Record<string, unknown>,
  keys: string[],
): Record<string, string | number | boolean | null> | undefined {
  const picked: Record<string, string | number | boolean | null> = {}

  for (const key of keys) {
    const value = details[key]
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      picked[key] = value
    }
  }

  return Object.keys(picked).length > 0 ? picked : undefined
}
