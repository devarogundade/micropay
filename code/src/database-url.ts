import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PoolConfig } from 'pg'

import { SUPABASE_ROOT_CA_2021 } from '#/lib/supabase-root-ca'

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

/** Strip sslmode query params — `pg` maps require→verify-full and hangs without ssl.ca. */
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

function resolveSslCa(): string {
  const caPath = process.env.DATABASE_SSL_ROOT_CERT
    ? resolve(process.env.DATABASE_SSL_ROOT_CERT)
    : join(appRoot, 'certs', 'prod-ca-2021.crt')

  if (existsSync(caPath)) {
    return readFileSync(caPath, 'utf8')
  }

  // Always available in the server bundle (Netlify functions often lack the file).
  return SUPABASE_ROOT_CA_2021
}

function warnIfDirectSupabaseHost(connectionString: string) {
  if (process.env.NODE_ENV !== 'production') return
  try {
    const host = new URL(connectionString).hostname
    // Direct host is often IPv6-only — unreachable from Netlify/AWS Lambda.
    if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) {
      console.warn(
        `[db] DATABASE_URL uses direct host ${host}. Netlify serverless usually needs the Supabase transaction pooler (aws-*.pooler.supabase.com:6543, user postgres.<project-ref>). See .env.example.`,
      )
    }
  } catch {
    // ignore malformed URL — getPgPoolConfig / pg will fail clearly
  }
}

/**
 * Pool config for node-postgres / PrismaPg.
 * Supabase requires TLS; CA comes from DATABASE_SSL_ROOT_CERT, certs/prod-ca-2021.crt,
 * or the embedded Supabase Root 2021 string (reliable on Netlify).
 *
 * Production / serverless: prefer Supabase shared pooler (port 6543, transaction mode).
 * Do not put `sslmode=require` on DATABASE_URL for this stack.
 */
export function getPgPoolConfig(): PoolConfig {
  const connectionString = connectionStringForPg(getDatabaseUrl())
  warnIfDirectSupabaseHost(connectionString)

  const isProd = process.env.NODE_ENV === 'production'

  return {
    connectionString,
    // Serverless: one client per isolate; pooler multiplexes on the server side.
    max: isProd ? 1 : 10,
    idleTimeoutMillis: isProd ? 10_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: {
      rejectUnauthorized: true,
      ca: resolveSslCa(),
    },
  }
}
