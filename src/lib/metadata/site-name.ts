const COMMON_HOST_PREFIXES = ['www.', 'm.', 'mobile.', 'amp.']

export function deriveSiteNameFromUrl(pageUrl: string): string | null {
  try {
    const hostname = new URL(pageUrl).hostname.toLowerCase()
    return stripCommonPrefixes(hostname)
  } catch {
    return null
  }
}

function stripCommonPrefixes(hostname: string): string {
  for (const prefix of COMMON_HOST_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return hostname.slice(prefix.length)
    }
  }

  return hostname
}
