import { defineConfig, env } from 'prisma/config'

/**
 * IDE product DB config. May share DATABASE_URL with app/.
 * Tables are Code* in public — never app User / Activity / Chat*.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
