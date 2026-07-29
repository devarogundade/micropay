import 'server-only'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'
import { getDatabaseUrl, getPgPoolConfig } from '../database-url.js'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var __prismaConnectionKey: string | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg(getPgPoolConfig()),
  })
}

const connectionKey = getDatabaseUrl()

// Vite soft-restarts keep globalThis across .env edits. Drop a stale client so
// chat-store / seed-aligned SSL pool config is used after DATABASE_URL changes.
if (
  globalThis.__prisma &&
  globalThis.__prismaConnectionKey !== connectionKey
) {
  void globalThis.__prisma.$disconnect()
  globalThis.__prisma = undefined
}

export const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
  globalThis.__prismaConnectionKey = connectionKey
}
