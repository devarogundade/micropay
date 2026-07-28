import { PrismaClient } from '../src/generated/prisma/client.js'
import { getPgPoolConfig } from '../src/database-url.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg(getPgPoolConfig())

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seed: no fake production data — database ready for real usage.')
  const users = await prisma.user.count()
  const activities = await prisma.activity.count()
  const sessions = await prisma.chatSession.count()
  console.log(
    `📊 Current rows — users: ${users}, activities: ${activities}, chat sessions: ${sessions}`,
  )
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
