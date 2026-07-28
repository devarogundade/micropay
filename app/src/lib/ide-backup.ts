/**
 * Backup / restore IDE projects (zip, folder picker, JSON).
 */

import JSZip from 'jszip'

import type { IdeFileNode, IdeProjectState } from '#/lib/puya-ts-project'
import {
  defaultProject,
  normalizePath,
  upsertFile,
  createFolder,
} from '#/lib/puya-ts-project'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadProjectZip(project: IdeProjectState) {
  const zip = new JSZip()
  for (const f of project.files) {
    if (f.kind === 'folder') {
      zip.folder(f.path)
    } else {
      zip.file(f.path, f.content)
    }
  }
  zip.file(
    '.micropay-ide.json',
    JSON.stringify(
      {
        name: project.name,
        activePath: project.activePath,
        github: project.github ?? null,
      },
      null,
      2,
    ),
  )
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${project.name || 'puya-ts-project'}.zip`)
}

export function downloadProjectJson(project: IdeProjectState) {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(blob, `${project.name || 'puya-ts-project'}.micropay.json`)
}

/** Write project into a user-picked directory (File System Access API). */
export async function saveProjectToDirectory(project: IdeProjectState) {
  const w = window as Window & {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite'
    }) => Promise<FileSystemDirectoryHandle>
  }
  if (!w.showDirectoryPicker) {
    throw new Error(
      'Folder save is not supported in this browser — use Download ZIP instead',
    )
  }
  const root = await w.showDirectoryPicker({ mode: 'readwrite' })
  for (const f of project.files) {
    if (f.kind === 'folder') {
      await ensureDir(root, f.path)
    } else {
      const dir = await ensureDir(root, parentOf(f.path))
      const handle = await dir.getFileHandle(basename(f.path), { create: true })
      const writable = await handle.createWritable()
      await writable.write(f.content)
      await writable.close()
    }
  }
}

async function ensureDir(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  const parts = normalizePath(path).split('/').filter(Boolean)
  let cur = root
  for (const part of parts) {
    cur = await cur.getDirectoryHandle(part, { create: true })
  }
  return cur
}

function parentOf(path: string) {
  const n = normalizePath(path)
  const i = n.lastIndexOf('/')
  return i <= 0 ? '' : n.slice(0, i)
}

function basename(path: string) {
  const n = normalizePath(path)
  const i = n.lastIndexOf('/')
  return i < 0 ? n : n.slice(i + 1)
}

function projectFromFiles(
  files: IdeFileNode[],
  name = 'puya-ts-project',
  activePath?: string,
): IdeProjectState {
  const fileNodes = files.filter((f) => f.kind === 'file')
  if (fileNodes.length === 0) {
    return defaultProject()
  }
  const active =
    (activePath && fileNodes.find((f) => f.path === activePath)?.path) ||
    fileNodes.find((f) => /\.algo\.ts$/i.test(f.path))?.path ||
    fileNodes[0].path
  return {
    name,
    files,
    activePath: active,
    versions: [],
    updatedAt: new Date().toISOString(),
    github: null,
  }
}

export async function loadProjectFromZip(file: File): Promise<IdeProjectState> {
  const zip = await JSZip.loadAsync(file)
  let files: IdeFileNode[] = []
  let meta: { name?: string; activePath?: string } | null = null

  const paths = Object.keys(zip.files)
  for (const path of paths) {
    const entry = zip.files[path]
    const n = normalizePath(path)
    if (!n || n === '.micropay-ide.json') {
      if (n === '.micropay-ide.json' && !entry.dir) {
        try {
          meta = JSON.parse(await entry.async('string')) as {
            name?: string
            activePath?: string
          }
        } catch {
          /* ignore */
        }
      }
      continue
    }
    if (entry.dir || n.endsWith('/')) {
      files.push({ path: n.replace(/\/$/, ''), kind: 'folder', content: '' })
      continue
    }
    // Skip junk / VCS
    if (n.startsWith('.') || n.includes('node_modules/')) continue
    const content = await entry.async('string')
    files.push({ path: n, kind: 'file', content })
  }

  // Ensure folder nodes for nested files
  for (const f of [...files]) {
    if (f.kind !== 'file') continue
    const parts = f.path.split('/')
    let cur = ''
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i]
      if (!files.some((x) => x.path === cur)) {
        files.push({ path: cur, kind: 'folder', content: '' })
      }
    }
  }

  return projectFromFiles(files, meta?.name || file.name.replace(/\.zip$/i, ''), meta?.activePath)
}

export async function loadProjectFromJson(
  file: File,
): Promise<IdeProjectState> {
  const text = await file.text()
  const parsed = JSON.parse(text) as IdeProjectState
  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error('Invalid Micropay project JSON')
  }
  return projectFromFiles(
    parsed.files,
    parsed.name || 'puya-ts-project',
    parsed.activePath,
  )
}

/** File System Access API directory open. */
export async function loadProjectFromDirectory(): Promise<IdeProjectState> {
  const w = window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
  if (!w.showDirectoryPicker) {
    throw new Error(
      'Directory picker not supported — use folder input or ZIP upload',
    )
  }
  const root = await w.showDirectoryPicker()
  const files = await readDirRecursive(root, '')
  return projectFromFiles(files, root.name || 'puya-ts-project')
}

async function readDirRecursive(
  dir: FileSystemDirectoryHandle,
  prefix: string,
): Promise<IdeFileNode[]> {
  const out: IdeFileNode[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const [name, handle] of (dir as any).entries() as AsyncIterable<
    [string, FileSystemHandle]
  >) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.')) {
      continue
    }
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      out.push({ path, kind: 'folder', content: '' })
      out.push(
        ...(await readDirRecursive(
          handle as FileSystemDirectoryHandle,
          path,
        )),
      )
    } else if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      // Skip large binaries
      if (file.size > 1_500_000) continue
      const content = await file.text()
      out.push({ path, kind: 'file', content })
    }
  }
  return out
}

/** Fallback: <input webkitdirectory> FileList → project. */
export function loadProjectFromFileList(
  list: FileList,
  projectName = 'puya-ts-project',
): IdeProjectState {
  let files: IdeFileNode[] = []
  const folderSet = new Set<string>()

  for (const file of Array.from(list)) {
    const rel =
      // webkitRelativePath is standard for directory inputs
      normalizePath(
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name,
      )
    if (!rel || rel.includes('node_modules/')) continue
    const parts = rel.split('/')
    // Drop the root folder name from webkitRelativePath
    const path =
      parts.length > 1 ? parts.slice(1).join('/') : parts[0]
    if (!path) continue
    const dirParts = path.split('/')
    let cur = ''
    for (let i = 0; i < dirParts.length - 1; i++) {
      cur = cur ? `${cur}/${dirParts[i]}` : dirParts[i]
      folderSet.add(cur)
    }
    files.push({ path, kind: 'file', content: '' })
  }

  // Second pass — need async read; this sync helper only structures paths.
  // Callers should use loadProjectFromFileListAsync instead.
  for (const folder of folderSet) {
    files.push({ path: folder, kind: 'folder', content: '' })
  }
  return projectFromFiles(files, projectName)
}

export async function loadProjectFromFileListAsync(
  list: FileList,
): Promise<IdeProjectState> {
  let state = defaultProject()
  state = { ...state, files: [], activePath: '' }
  let rootName = 'puya-ts-project'

  for (const file of Array.from(list)) {
    const rel = normalizePath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
    )
    if (!rel || rel.includes('node_modules/')) continue
    const parts = rel.split('/')
    if (parts.length > 1) rootName = parts[0] || rootName
    const path = parts.length > 1 ? parts.slice(1).join('/') : parts[0]
    if (!path || path.startsWith('.')) continue
    if (file.size > 1_500_000) continue
    const content = await file.text()
    // create parent folders
    const dirParts = path.split('/')
    let cur = ''
    for (let i = 0; i < dirParts.length - 1; i++) {
      cur = cur ? `${cur}/${dirParts[i]}` : dirParts[i]
      try {
        if (!state.files.some((f) => f.path === cur)) {
          state = createFolder(state, cur)
        }
      } catch {
        /* exists */
      }
    }
    state = upsertFile(state, path, content)
  }

  if (state.files.filter((f) => f.kind === 'file').length === 0) {
    return defaultProject()
  }
  return { ...state, name: rootName }
}
