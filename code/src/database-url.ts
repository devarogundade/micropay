import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PoolConfig } from 'pg'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Minimal .env loader. Vite only exposes VITE_* via import.meta.env; Prisma/pg
 * need process.env.DATABASE_URL. Bun loads .env once at process start, so on
 * Vite soft-restarts we must re-read files to pick up DATABASE_URL edits.
 */
function loadEnvFile(filePath: string, override: boolean) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export function ensureDatabaseEnv() {
  const envPath = join(appRoot, '.env')
  const localPath = join(appRoot, '.env.local')

  if (process.env.NODE_ENV === 'production') {
    // Fill gaps only — never clobber platform-provided secrets.
    loadEnvFile(envPath, false)
    return
  }

  loadEnvFile(envPath, false)
  if (existsSync(localPath)) {
    loadEnvFile(localPath, true)
  } else {
    // Re-apply .env so Vite soft-restarts see file edits.
    loadEnvFile(envPath, true)
  }
}

export function getDatabaseUrl() {
  ensureDatabaseEnv()
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  return databaseUrl
}

/**
 * Strip sslmode / sslrootcert from the URL.
 * `pg` maps sslmode=require → verify-full and can hang or fail when a custom
 * CA is also passed; we configure TLS via PoolConfig.ssl instead.
 */
function connectionStringForPg(raw: string): string {
  try {
    const url = new URL(raw)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('sslrootcert')
    return url.toString()
  } catch {
    return raw
  }
}

/**
 * Pool config for node-postgres / PrismaPg.
 * Postgres is Netlify DB (Neon). TLS uses the platform trust store — do not
 * pin a Supabase CA. Prefer Netlify-injected DATABASE_URL in production.
 */
export function getPgPoolConfig(): PoolConfig {
  const connectionString = connectionStringForPg(getDatabaseUrl())
  const isProd = process.env.NODE_ENV === 'production'

  return {
    connectionString,
    // Serverless: one client per isolate; pooler multiplexes on the server side.
    max: isProd ? 1 : 10,
    idleTimeoutMillis: isProd ? 10_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: {
      rejectUnauthorized: true,
    },
  }
}
