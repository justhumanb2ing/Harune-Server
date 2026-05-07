import { HTTPException } from 'hono/http-exception'

export function parseInputUrl(rawUrl: string): URL {
  let url: URL

  try {
    url = new URL(rawUrl)
  } catch {
    throw new HTTPException(400, {
      message: 'url must be a valid absolute URL',
      cause: { error: 'invalid_url', rawUrl },
    })
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HTTPException(400, {
      message: 'url must use http or https',
      cause: { error: 'invalid_protocol', protocol: url.protocol },
    })
  }

  if (isBlockedHostname(url.hostname)) {
    throw new HTTPException(400, {
      message: 'url points to a blocked host',
      cause: { error: 'blocked_host', hostname: url.hostname },
    })
  }

  return url
}

export function resolveAndValidateUrl(location: string, baseUrl: URL): URL {
  const nextUrl = new URL(location, baseUrl)
  return parseInputUrl(nextUrl.toString())
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true
  }

  if (isPrivateIpv4(normalized)) {
    return true
  }

  if (isPrivateIpv6(normalized)) {
    return true
  }

  return false
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) {
    return false
  }

  const octets = match.slice(1).map((value) => Number(value))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true
  }

  const [a, b] = octets

  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true
  }

  return false
}
