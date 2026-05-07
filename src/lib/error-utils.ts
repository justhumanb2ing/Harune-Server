import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  badGateway,
  badRequest,
  forbidden,
  internalServerError,
  notFound,
  unauthorized,
} from './api-response'

export function extractCauseDetails(
  cause: unknown,
): Record<string, unknown> | undefined {
  if (!cause || typeof cause !== 'object') {
    return undefined
  }

  const record = cause as Record<string, unknown>
  const { error, ...rest } = record
  if (Object.keys(rest).length === 0) {
    return undefined
  }

  return rest
}

export function getErrorCodeFromStatus(
  status: number,
  details?: Record<string, unknown>,
): string {
  if (details && typeof details.error === 'string' && details.error.length > 0) {
    return details.error
  }

  switch (status) {
    case 400:
      return 'bad_request'
    case 401:
      return 'unauthorized'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 502:
      return 'bad_gateway'
    default:
      return 'internal_error'
  }
}

export function handleHonoError(err: unknown, c: Context) {
  if (err instanceof HTTPException) {
    const details = extractCauseDetails(err.cause)
    const code = getErrorCodeFromStatus(err.status, details)
    const message = err.message || 'request failed'

    switch (err.status) {
      case 400:
        return badRequest(c, code, message, details)
      case 401:
        return unauthorized(c, code, message, details)
      case 403:
        return forbidden(c, code, message, details)
      case 502:
        return badGateway(c, code, message, details)
      case 404:
        return notFound(c, code, message, details)
      case 500:
      default:
        return internalServerError(c, code, message, details)
    }
  }

  return internalServerError(
    c,
    'internal_error',
    err instanceof Error ? err.message : 'internal server error',
  )
}
