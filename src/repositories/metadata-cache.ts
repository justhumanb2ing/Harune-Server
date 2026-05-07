import { Redis } from '@upstash/redis/cloudflare'
import { HTTPException } from 'hono/http-exception'
import type { NormalizedMetadata } from '../types/metadata'
import type { AppBindings } from '../types/types'

export interface MetadataCacheStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts?: { nx?: true; ex?: number }): Promise<unknown>
  setex(key: string, ttl: number, value: string): Promise<unknown>
  del(key: string): Promise<number>
}

type CacheEnvelope =
  | { kind: 'metadata'; data: NormalizedMetadata }
  | { kind: 'failure'; error: { message: string; code: string } }

const CACHE_PREFIX = 'harune:metadata:v1'
const POSITIVE_TTL_SECONDS = 60 * 60 * 24
const NEGATIVE_TTL_SECONDS = 60 * 10
const LOCK_TTL_SECONDS = 20
const WAIT_ATTEMPTS = 8
const WAIT_DELAY_MS = 125

export function createMetadataCacheStore(
  env?: Partial<AppBindings['Bindings']>,
): MetadataCacheStore | null {
  if (!env?.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  const redis = Redis.fromEnv({
    UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_DISABLE_TELEMETRY: env.UPSTASH_DISABLE_TELEMETRY,
  })

  return {
    get: (key) => redis.get<string>(key),
    set: (key, value, opts) => redis.set(key, value, opts as never),
    setex: (key, ttl, value) => redis.setex(key, ttl, value),
    del: (key) => redis.del(key),
  }
}

export async function resolveMetadataWithCache(
  url: URL,
  loader: () => Promise<NormalizedMetadata>,
  store: MetadataCacheStore | null,
): Promise<NormalizedMetadata> {
  if (!store) {
    return loader()
  }

  const cacheKey = await buildCacheKey(url)
  const lockKey = `${cacheKey}:lock`

  const cached = await readCacheEntry(store, cacheKey)
  if (cached?.kind === 'metadata') {
    return cached.data
  }
  if (cached?.kind === 'failure') {
    throw new HTTPException(502, {
      message: cached.error.message,
      cause: { error: cached.error.code },
    })
  }

  const lockToken = createLockToken()
  const acquired = await store.set(lockKey, lockToken, {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  })

  if (acquired === 'OK' || acquired === lockToken) {
    return await loadAndCache(loader, store, cacheKey, lockKey, lockToken)
  }

  for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
    await sleep(WAIT_DELAY_MS)
    const settled = await readCacheEntry(store, cacheKey)
    if (settled?.kind === 'metadata') {
      return settled.data
    }
    if (settled?.kind === 'failure') {
      throw new HTTPException(502, {
        message: settled.error.message,
        cause: { error: settled.error.code },
      })
    }
  }

  return await loadAndCache(loader, store, cacheKey, lockKey, lockToken)
}

async function loadAndCache(
  loader: () => Promise<NormalizedMetadata>,
  store: MetadataCacheStore,
  cacheKey: string,
  lockKey: string,
  lockToken: string,
): Promise<NormalizedMetadata> {
  try {
    const metadata = await loader()
    await store.setex(cacheKey, POSITIVE_TTL_SECONDS, JSON.stringify({
      kind: 'metadata',
      data: metadata,
    } satisfies CacheEnvelope))
    return metadata
  } catch (error) {
    const httpError =
      error instanceof HTTPException
        ? error
        : new HTTPException(502, {
            message: 'failed to fetch metadata',
            cause: { error: 'fetch_failed' },
          })

    await store.setex(cacheKey, NEGATIVE_TTL_SECONDS, JSON.stringify({
      kind: 'failure',
      error: {
        code: getErrorCode(httpError),
        message: httpError.message || 'failed to fetch metadata',
      },
    } satisfies CacheEnvelope))
    throw httpError
  } finally {
    await releaseLock(store, lockKey, lockToken)
  }
}

async function readCacheEntry(
  store: MetadataCacheStore,
  key: string,
): Promise<CacheEnvelope | null> {
  const raw = await store.get(key)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as CacheEnvelope
  } catch {
    return null
  }
}

async function releaseLock(
  store: MetadataCacheStore,
  lockKey: string,
  lockToken: string,
): Promise<void> {
  const current = await store.get(lockKey)
  if (current === lockToken) {
    await store.del(lockKey)
  }
}

function getErrorCode(error: HTTPException): string {
  const cause = error.cause
  if (cause && typeof cause === 'object') {
    const value = (cause as Record<string, unknown>).error
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return error.status >= 500 ? 'fetch_failed' : 'missing_url'
}

async function buildCacheKey(url: URL): Promise<string> {
  const normalized = new URL(url.toString())
  normalized.hash = ''
  normalized.searchParams.sort()
  return `${CACHE_PREFIX}:${await sha256Hex(normalized.toString())}`
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function createLockToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
