/**
 * Code-owned template catalog + clone tracking (CodeTemplate / CodeTemplateClone).
 * Same DATABASE_URL as app; does not use Activity/User for clones.
 */

import 'server-only'

import type { Prisma } from '../generated/prisma/client.js'

import { TEMPLATE_CLONE_USDC } from '#/data/models'
import { prisma } from '#/lib/db'
import { IDE_TEMPLATES } from '#/lib/ide-templates'
import type {
  TemplateDetail,
  TemplateFile,
  TemplateListItem,
  TemplateSort,
} from '#/lib/templates-types'

export { TEMPLATE_CLONE_USDC }
export type {
  TemplateDetail,
  TemplateFile,
  TemplateListItem,
  TemplateSort,
} from '#/lib/templates-types'

const SEED_META: Record<
  string,
  { category: string; featured: boolean }
> = {
  hello: { category: 'starter', featured: true },
  counter: { category: 'state', featured: true },
  asa: { category: 'asset', featured: true },
}

function parseFiles(raw: unknown): TemplateFile[] {
  if (!Array.isArray(raw)) return []
  const out: TemplateFile[] = []
  for (const item of raw) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { path?: unknown }).path === 'string' &&
      typeof (item as { content?: unknown }).content === 'string'
    ) {
      out.push({
        path: (item as { path: string }).path,
        content: (item as { content: string }).content,
      })
    }
  }
  return out
}

function toListItem(row: {
  id: string
  slug: string
  name: string
  description: string
  category: string
  projectName: string
  activePath: string
  files: unknown
  clonedCount: number
  featured: boolean
  createdAt: Date
  updatedAt: Date
}): TemplateListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    projectName: row.projectName,
    activePath: row.activePath,
    clonedCount: row.clonedCount,
    featured: row.featured,
    fileCount: parseFiles(row.files).length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toDetail(row: Parameters<typeof toListItem>[0]): TemplateDetail {
  return {
    ...toListItem(row),
    files: parseFiles(row.files),
  }
}

/** Upsert built-in starters when the catalog is empty. */
export async function ensureTemplatesSeeded(): Promise<void> {
  const count = await prisma.codeTemplate.count()
  if (count > 0) return

  for (const t of IDE_TEMPLATES) {
    const meta = SEED_META[t.id] ?? {
      category: 'starter',
      featured: false,
    }
    await prisma.codeTemplate.upsert({
      where: { slug: t.id },
      create: {
        slug: t.id,
        name: t.name,
        description: t.description,
        category: meta.category,
        projectName: t.projectName,
        activePath: t.activePath,
        files: t.files as unknown as Prisma.InputJsonValue,
        featured: meta.featured,
        clonedCount: 0,
      },
      update: {},
    })
  }
}

export async function listTemplates(input: {
  q?: string
  category?: string
  sort?: TemplateSort
}): Promise<{ templates: TemplateListItem[]; categories: string[] }> {
  await ensureTemplatesSeeded()

  const where: Prisma.CodeTemplateWhereInput = {}
  const q = input.q?.trim()
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { projectName: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (input.category && input.category !== 'all') {
    where.category = input.category
  }

  const sort = input.sort ?? 'popular'
  let orderBy: Prisma.CodeTemplateOrderByWithRelationInput[]
  switch (sort) {
    case 'newest':
      orderBy = [{ createdAt: 'desc' }]
      break
    case 'name':
      orderBy = [{ name: 'asc' }]
      break
    case 'clones':
    case 'clones-desc':
      orderBy = [{ clonedCount: 'desc' }, { name: 'asc' }]
      break
    case 'clones-asc':
      orderBy = [{ clonedCount: 'asc' }, { name: 'asc' }]
      break
    case 'popular':
    default:
      orderBy = [
        { featured: 'desc' },
        { clonedCount: 'desc' },
        { name: 'asc' },
      ]
      break
  }

  const [rows, categoryRows] = await Promise.all([
    prisma.codeTemplate.findMany({ where, orderBy }),
    prisma.codeTemplate.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    }),
  ])

  return {
    templates: rows.map(toListItem),
    categories: categoryRows.map((c) => c.category),
  }
}

export async function getTemplateByIdOrSlug(
  idOrSlug: string,
): Promise<TemplateDetail | null> {
  await ensureTemplatesSeeded()
  const row = await prisma.codeTemplate.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  })
  return row ? toDetail(row) : null
}

/**
 * After successful x402 settle: write CodeTemplateClone + increment clonedCount.
 * Returns the template payload for the IDE.
 */
export async function recordPaidTemplateClone(input: {
  templateId: string
  walletAddress: string | null
  txId: string
  costUsdc?: number
}): Promise<TemplateDetail> {
  const costUsdc = input.costUsdc ?? TEMPLATE_CLONE_USDC

  const updated = await prisma.$transaction(async (tx) => {
    const template = await tx.codeTemplate.findUnique({
      where: { id: input.templateId },
    })
    if (!template) {
      throw new Error('Template not found')
    }

    await tx.codeTemplateClone.create({
      data: {
        templateId: template.id,
        walletAddress: input.walletAddress,
        txId: input.txId,
        costUsdc,
      },
    })

    return tx.codeTemplate.update({
      where: { id: template.id },
      data: { clonedCount: { increment: 1 } },
    })
  })

  return toDetail(updated)
}
