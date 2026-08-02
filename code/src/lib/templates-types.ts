/** Browser-safe template API types. */

export type TemplateFile = { path: string; content: string }

export type TemplateListItem = {
  id: string
  slug: string
  name: string
  description: string
  category: string
  projectName: string
  activePath: string
  clonedCount: number
  featured: boolean
  fileCount: number
  createdAt: string
  updatedAt: string
}

export type TemplateDetail = TemplateListItem & {
  files: TemplateFile[]
}

export type TemplateSort =
  | 'popular'
  | 'newest'
  | 'name'
  | 'clones'
  | 'clones-asc'
  | 'clones-desc'
