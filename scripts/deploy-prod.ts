import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

type EnvMap = Record<string, string>

const SECRET_KEYS = [
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

const envPath = fileURLToPath(String(new URL('../.env.prod', import.meta.url)))
const envFile = await readFile(envPath, 'utf8')
const env = parseDotEnv(envFile)

for (const key of SECRET_KEYS) {
  const value = env[key]
  if (!value) {
    throw new Error(`Missing ${key} in .env.prod`)
  }

  const result = spawnSync(
    'bunx',
    ['wrangler', 'secret', 'put', key],
    {
      input: `${value}\n`,
      stdio: ['pipe', 'inherit', 'inherit'],
      encoding: 'utf8',
    },
  )

  if (result.status !== 0) {
    throw new Error(`Failed to register secret ${key}`)
  }
}

const deploy = spawnSync(
  'bunx',
  ['wrangler', 'deploy', '--minify'],
  {
    stdio: 'inherit',
    encoding: 'utf8',
  },
)

if (deploy.status !== 0) {
  throw new Error('Deployment failed')
}

function parseDotEnv(source: string): EnvMap {
  const env: EnvMap = {}

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}
