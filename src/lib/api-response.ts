import type { Context } from 'hono'

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

type JsonContext = Pick<Context, 'json'>
type ErrorStatus = 400 | 401 | 403 | 404 | 500 | 502

export function errorResponse(
  c: JsonContext,
  status: ErrorStatus,
  code: string,
  message: string,
  details?: unknown,
) {
  return c.json<ApiErrorBody>(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status,
  )
}

export function validationError(
  c: JsonContext,
  details?: unknown,
) {
  return errorResponse(c, 400, 'validation_error', 'invalid request', details)
}

export function badRequest(
  c: JsonContext,
  code: string,
  message: string,
  details?: unknown,
) {
  return errorResponse(c, 400, code, message, details)
}

export function unauthorized(
  c: JsonContext,
  code: string,
  message: string,
  details?: unknown,
) {
  return errorResponse(c, 401, code, message, details)
}

export function forbidden(
  c: JsonContext,
  code: string,
  message: string,
  details?: unknown,
) {
  return errorResponse(c, 403, code, message, details)
}

export function notFound(
  c: JsonContext,
  code: string,
  message: string,
  details?: unknown,
) {
  return errorResponse(c, 404, code, message, details)
}

export function badGateway(
  c: JsonContext,
  code: string,
  message: string,
  details?: unknown,
) {
  return errorResponse(c, 502, code, message, details)
}

export function internalServerError(
  c: JsonContext,
  code: string,
  message: string,
  details?: unknown,
) {
  return errorResponse(c, 500, code, message, details)
}
