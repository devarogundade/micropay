/**
 * Multi-file puya-ts IDE project model (localStorage-backed).
 */

import {
  STARTER_CONTRACT,
  STARTER_FILENAME,
} from '#/components/puya-ts/starter-contract'

const STORAGE_KEY = 'micropay.puya-ts.ide.v2'
const LEGACY_V1_KEY = 'micropay.puya-ts.ide.v1'
const LEGACY_TEALSCRIPT_KEY = 'micropay.tealscript.ide.v1'

export type IdeFileKind = 'file' | 'folder'

export type IdeFileNode = {
  path: string
  kind: IdeFileKind
  /** Present for files; empty for folders. */
  content: string
}

export type IdeProjectVersion = {
  id: string
  label: string
  files: IdeFileNode[]
  activePath: string
  createdAt: string
}

export type IdeProjectState = {
  name: string
  files: IdeFileNode[]
  activePath: string
  versions: IdeProjectVersion[]
  updatedAt: string
  /** Optional GitHub remote metadata */
  github?: {
    owner: string
    repo: string
    branch: string
    pathPrefix?: string
  } | null
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim()
}

export function parentPath(path: string): string {
  const n = normalizePath(path)
  const i = n.lastIndexOf('/')
  return i <= 0 ? '' : n.slice(0, i)
}

export function basename(path: string): string {
  const n = normalizePath(path)
  const i = n.lastIndexOf('/')
  return i < 0 ? n : n.slice(i + 1)
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join('/'))
}

export function defaultProject(): IdeProjectState {
  return {
    name: 'puya-ts-project',
    files: [
      {
        path: STARTER_FILENAME,
        kind: 'file',
        content: STARTER_CONTRACT,
      },
    ],
    activePath: STARTER_FILENAME,
    versions: [],
    updatedAt: new Date().toISOString(),
    github: null,
  }
}

function coerceFiles(raw: unknown): IdeFileNode[] {
  if (!Array.isArray(raw)) return defaultProject().files
  const out: IdeFileNode[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const path = normalizePath(String((item as IdeFileNode).path || ''))
    if (!path || seen.has(path)) continue
    const kind: IdeFileKind =
      (item as IdeFileNode).kind === 'folder' ? 'folder' : 'file'
    seen.add(path)
    out.push({
      path,
      kind,
      content: kind === 'file' ? String((item as IdeFileNode).content ?? '') : '',
    })
  }
  return out.length ? out : defaultProject().files
}

function migrateFromV1(raw: string): IdeProjectState {
  try {
    const parsed = JSON.parse(raw) as {
      filename?: string
      source?: string
      versions?: Array<{
        id: string
        label: string
        filename: string
        source: string
        createdAt: string
      }>
      updatedAt?: string
    }
    const filename =
      parsed.filename === 'Counter.algo.ts'
        ? STARTER_FILENAME
        : parsed.filename || STARTER_FILENAME
    const source =
      typeof parsed.source === 'string' ? parsed.source : STARTER_CONTRACT
    const versions: IdeProjectVersion[] = Array.isArray(parsed.versions)
      ? parsed.versions.slice(0, 40).map((v) => ({
          id: v.id,
          label: v.label,
          activePath: v.filename || filename,
          createdAt: v.createdAt,
          files: [
            {
              path: v.filename || filename,
              kind: 'file' as const,
              content: v.source,
            },
          ],
        }))
      : []
    return {
      name: 'puya-ts-project',
      files: [{ path: filename, kind: 'file', content: source }],
      activePath: filename,
      versions,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      github: null,
    }
  } catch {
    return defaultProject()
  }
}

function parseProject(raw: string): IdeProjectState {
  const parsed = JSON.parse(raw) as Partial<IdeProjectState>
  // Detect legacy single-file shape
  if (
    typeof (parsed as { source?: unknown }).source === 'string' &&
    !Array.isArray(parsed.files)
  ) {
    return migrateFromV1(raw)
  }
  const files = coerceFiles(parsed.files)
  const activePath = normalizePath(parsed.activePath || '')
  const active =
    files.find((f) => f.kind === 'file' && f.path === activePath)?.path ??
    files.find((f) => f.kind === 'file')?.path ??
    STARTER_FILENAME
  return {
    name: typeof parsed.name === 'string' ? parsed.name : 'puya-ts-project',
    files,
    activePath: active,
    versions: Array.isArray(parsed.versions)
      ? (parsed.versions as IdeProjectVersion[]).slice(0, 40)
      : [],
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    github: parsed.github ?? null,
  }
}

export function loadIdeProject(): IdeProjectState {
  if (typeof window === 'undefined') return defaultProject()
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem(LEGACY_V1_KEY) ??
      localStorage.getItem(LEGACY_TEALSCRIPT_KEY)
    if (!raw) return defaultProject()
    return parseProject(raw)
  } catch {
    return defaultProject()
  }
}

export function saveIdeProject(state: IdeProjectState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        versions: state.versions.slice(0, 40),
        updatedAt: new Date().toISOString(),
      }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function getFile(
  state: IdeProjectState,
  path: string,
): IdeFileNode | undefined {
  const n = normalizePath(path)
  return state.files.find((f) => f.path === n)
}

export function getActiveFile(state: IdeProjectState): IdeFileNode | undefined {
  return getFile(state, state.activePath)
}

export function listFiles(state: IdeProjectState): IdeFileNode[] {
  return [...state.files].sort((a, b) => a.path.localeCompare(b.path))
}

/** Ensure parent folder nodes exist for a path. */
export function ensureFolders(
  files: IdeFileNode[],
  filePath: string,
): IdeFileNode[] {
  const parts = normalizePath(filePath).split('/').filter(Boolean)
  if (parts.length <= 1) return files
  const next = [...files]
  const existing = new Set(next.map((f) => f.path))
  let cur = ''
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur ? `${cur}/${parts[i]}` : parts[i]
    if (!existing.has(cur)) {
      next.push({ path: cur, kind: 'folder', content: '' })
      existing.add(cur)
    }
  }
  return next
}

export function upsertFile(
  state: IdeProjectState,
  path: string,
  content: string,
): IdeProjectState {
  const n = normalizePath(path)
  if (!n) return state
  let files = ensureFolders(state.files, n)
  const idx = files.findIndex((f) => f.path === n)
  if (idx >= 0) {
    if (files[idx].kind === 'folder') {
      throw new Error(`Cannot write file over folder: ${n}`)
    }
    files = files.map((f, i) =>
      i === idx ? { ...f, kind: 'file' as const, content } : f,
    )
  } else {
    files = [...files, { path: n, kind: 'file', content }]
  }
  return {
    ...state,
    files,
    activePath: n,
    updatedAt: new Date().toISOString(),
  }
}

export function createFolder(
  state: IdeProjectState,
  path: string,
): IdeProjectState {
  const n = normalizePath(path)
  if (!n) return state
  if (state.files.some((f) => f.path === n)) {
    throw new Error(`Path already exists: ${n}`)
  }
  let files = ensureFolders(state.files, `${n}/.keep`)
  files = [...files, { path: n, kind: 'folder', content: '' }]
  return { ...state, files, updatedAt: new Date().toISOString() }
}

export function renamePath(
  state: IdeProjectState,
  from: string,
  to: string,
): IdeProjectState {
  const src = normalizePath(from)
  const dest = normalizePath(to)
  if (!src || !dest || src === dest) return state
  if (state.files.some((f) => f.path === dest)) {
    throw new Error(`Destination already exists: ${dest}`)
  }
  const node = state.files.find((f) => f.path === src)
  if (!node) throw new Error(`Not found: ${src}`)

  let files = state.files.filter(
    (f) => f.path !== src && !f.path.startsWith(`${src}/`),
  )
  if (node.kind === 'folder') {
    const children = state.files.filter(
      (f) => f.path === src || f.path.startsWith(`${src}/`),
    )
    for (const child of children) {
      const newPath =
        child.path === src ? dest : `${dest}${child.path.slice(src.length)}`
      files = ensureFolders(files, child.kind === 'file' ? newPath : `${newPath}/x`)
      files = [
        ...files.filter((f) => f.path !== newPath),
        { ...child, path: newPath },
      ]
    }
  } else {
    files = ensureFolders(files, dest)
    files = [...files, { ...node, path: dest }]
  }

  const activePath =
    state.activePath === src || state.activePath.startsWith(`${src}/`)
      ? state.activePath === src
        ? dest
        : `${dest}${state.activePath.slice(src.length)}`
      : state.activePath

  return {
    ...state,
    files: coerceFiles(files),
    activePath,
    updatedAt: new Date().toISOString(),
  }
}

export function deletePath(
  state: IdeProjectState,
  path: string,
): IdeProjectState {
  const n = normalizePath(path)
  const remaining = state.files.filter(
    (f) => f.path !== n && !f.path.startsWith(`${n}/`),
  )
  if (remaining.filter((f) => f.kind === 'file').length === 0) {
    throw new Error('Cannot delete the last file in the project')
  }
  const activePath =
    state.activePath === n || state.activePath.startsWith(`${n}/`)
      ? remaining.find((f) => f.kind === 'file')!.path
      : state.activePath
  return {
    ...state,
    files: remaining,
    activePath,
    updatedAt: new Date().toISOString(),
  }
}

export function setActivePath(
  state: IdeProjectState,
  path: string,
): IdeProjectState {
  const n = normalizePath(path)
  const file = state.files.find((f) => f.path === n && f.kind === 'file')
  if (!file) return state
  return { ...state, activePath: n }
}

export function updateActiveContent(
  state: IdeProjectState,
  content: string,
): IdeProjectState {
  return {
    ...state,
    files: state.files.map((f) =>
      f.path === state.activePath && f.kind === 'file'
        ? { ...f, content }
        : f,
    ),
    updatedAt: new Date().toISOString(),
  }
}

export function snapshotProject(
  state: IdeProjectState,
  label?: string,
): IdeProjectState {
  const last = state.versions[0]
  if (
    last &&
    last.activePath === state.activePath &&
    JSON.stringify(last.files) === JSON.stringify(state.files)
  ) {
    return state
  }
  const version: IdeProjectVersion = {
    id: uid(),
    label: label || `Snapshot ${new Date().toLocaleString()}`,
    files: state.files.map((f) => ({ ...f })),
    activePath: state.activePath,
    createdAt: new Date().toISOString(),
  }
  return {
    ...state,
    versions: [version, ...state.versions].slice(0, 40),
    updatedAt: new Date().toISOString(),
  }
}

export function restoreProjectVersion(
  state: IdeProjectState,
  versionId: string,
): IdeProjectState {
  const v = state.versions.find((x) => x.id === versionId)
  if (!v) return state
  return {
    ...state,
    files: v.files.map((f) => ({ ...f })),
    activePath: v.activePath,
    updatedAt: new Date().toISOString(),
  }
}

/** Files suitable for puya-ts compile (`.algo.ts` + supporting `.ts`). */
export function compileFileMap(
  state: IdeProjectState,
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of state.files) {
    if (f.kind !== 'file') continue
    if (/\.(algo\.)?tsx?$/i.test(f.path)) {
      map[f.path] = f.content
    }
  }
  return map
}

export function pickEntryFile(
  state: IdeProjectState,
  entry?: string,
): string {
  if (entry) {
    const n = normalizePath(entry)
    if (state.files.some((f) => f.path === n && f.kind === 'file')) return n
  }
  const active = getActiveFile(state)
  if (active && /\.algo\.ts$/i.test(active.path)) return active.path
  const algo = state.files.find(
    (f) => f.kind === 'file' && /\.algo\.ts$/i.test(f.path),
  )
  if (algo) return algo.path
  return (
    state.files.find((f) => f.kind === 'file')?.path ?? STARTER_FILENAME
  )
}

/** Flat tree rows for the explorer UI. */
export type TreeRow = {
  path: string
  name: string
  kind: IdeFileKind
  depth: number
}

export function buildTreeRows(
  files: IdeFileNode[],
  expanded: Set<string>,
): TreeRow[] {
  const sorted = [...files].sort((a, b) => {
    const ap = a.path.split('/')
    const bp = b.path.split('/')
    const len = Math.min(ap.length, bp.length)
    for (let i = 0; i < len; i++) {
      if (ap[i] !== bp[i]) {
        const aIsLast = i === ap.length - 1
        const bIsLast = i === bp.length - 1
        if (aIsLast && a.kind === 'folder' && !(bIsLast && b.kind === 'folder'))
          return -1
        if (bIsLast && b.kind === 'folder' && !(aIsLast && a.kind === 'folder'))
          return 1
        return ap[i].localeCompare(bp[i])
      }
    }
    return a.path.localeCompare(b.path)
  })

  const rows: TreeRow[] = []
  for (const f of sorted) {
    const parts = f.path.split('/')
    const depth = parts.length - 1
    let hidden = false
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join('/')
      if (!expanded.has(ancestor)) {
        hidden = true
        break
      }
    }
    if (hidden) continue
    rows.push({
      path: f.path,
      name: parts[parts.length - 1],
      kind: f.kind,
      depth,
    })
  }
  return rows
}
