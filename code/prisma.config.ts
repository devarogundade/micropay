import { defineConfig, env } from 'prisma/config'

/**
 * IDE product DB config. May share DATABASE_URL with app/, but tables live in
 * PostgreSQL schema `code` (see schema.prisma schemas=["code"]).
 * `db push` only manages that schema — never drops app/public tables.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
