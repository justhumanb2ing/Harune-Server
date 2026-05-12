import { HTTPException } from 'hono/http-exception'
import type { NormalizedMetadata } from '../../types/metadata'
import { extractMetadata } from './html'
import { fetchGithubMetadata, isGithubProfileUrl } from './github'
import { resolveAndValidateUrl } from './url'

const MAX_HTML_BYTES = 1_500_000
const MAX_HEAD_BYTES = 128_000
const MAX_REDIRECTS = 5
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<major>.0.0.0 Safari/537.36'

export async function fetchMetadata(
  initialUrl: URL,
  options?: {
    githubToken?: string | null
  },
): Promise<NormalizedMetadata> {
  if (isGithubProfileUrl(initialUrl)) {
    return fetchGithubMetadata(initialUrl, {
      token: options?.githubToken ?? null,
    })
  }

  let currentUrl = initialUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response: Response

    try {
      response = await fetch(currentUrl.toString(), {
        redirect: 'manual',
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'user-agent': USER_AGENT,
        },
      })
    } catch (error) {
      throw new HTTPException(502, {
        message: 'failed to fetch target url',
        cause: {
          error: 'fetch_failed',
          reason: error instanceof Error ? error.message : 'unknown',
        },
      })
    }

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get('location')
      if (!location) {
        throw new HTTPException(502, {
          message: 'redirect response missing location header',
          cause: { error: 'fetch_failed' },
        })
      }

      currentUrl = resolveAndValidateUrl(location, currentUrl)
      continue
    }

    if (!response.ok) {
      throw new HTTPException(502, {
        message: 'target responded with an error status',
        cause: { error: 'fetch_failed', status: response.status },
      })
    }

    const headHtml = await readHeadTextWithLimit(response, MAX_HEAD_BYTES)
    if (headHtml.text) {
      return extractMetadata(headHtml.text, currentUrl.toString())
    }

    const fullHtml = await fetchFullDocument(currentUrl)
    return extractMetadata(fullHtml, currentUrl.toString())
  }

  throw new HTTPException(502, {
    message: 'too many redirects',
    cause: { error: 'fetch_failed' },
  })
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400
}

async function fetchFullDocument(url: URL): Promise<string> {
  let response: Response

  try {
    response = await fetch(url.toString(), {
      redirect: 'manual',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'user-agent': USER_AGENT,
      },
    })
  } catch (error) {
    throw new HTTPException(502, {
      message: 'failed to fetch target url',
      cause: {
        error: 'fetch_failed',
        reason: error instanceof Error ? error.message : 'unknown',
      },
    })
  }

  if (!response.ok) {
    throw new HTTPException(502, {
      message: 'target responded with an error status',
      cause: { error: 'fetch_failed', status: response.status },
    })
  }

  return readTextWithLimit(response, MAX_HTML_BYTES)
}

async function readHeadTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; complete: boolean }> {
  if (!response.body) {
    return { text: '', complete: false }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let totalBytes = 0
  let buffer = ''
  const marker = '</head>'

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      return {
        text: chunks.join('') + buffer,
        complete: false,
      }
    }

    buffer += decoder.decode(value, { stream: true })
    const markerIndex = buffer.toLowerCase().indexOf(marker)
    if (markerIndex !== -1) {
      chunks.push(buffer.slice(0, markerIndex + marker.length))
      await reader.cancel()
      return {
        text: chunks.join('') + decoder.decode(),
        complete: true,
      }
    }
  }

  chunks.push(buffer, decoder.decode())
  return {
    text: chunks.join(''),
    complete: false,
  }
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new HTTPException(502, {
        message: 'response body is too large',
        cause: { error: 'fetch_failed' },
      })
    }

    chunks.push(decoder.decode(value, { stream: true }))
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}
