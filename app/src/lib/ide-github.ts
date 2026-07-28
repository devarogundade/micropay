/**
 * Practical GitHub import/export for the IDE (PAT-based).
 *
 * There is no OAuth flow in Micropay. Users paste a classic/fine-grained PAT
 * (repo scope) stored only in localStorage. Public repos can be imported
 * without a token via the Contents API (rate-limited).
 */

import type { IdeFileNode, IdeProjectState } from '#/lib/puya-ts-project'
import {
  defaultProject,
  normalizePath,
  upsertFile,
  createFolder,
} from '#/lib/puya-ts-project'

const PAT_KEY = 'micropay.ide.github.pat.v1'

export type GitHubRemote = {
  owner: string
  repo: string
  branch: string
  pathPrefix?: string
}

export function loadGithubPat(): string {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(PAT_KEY) || ''
  } catch {
    return ''
  }
}

export function saveGithubPat(token: string) {
  if (typeof window === 'undefined') return
  try {
    if (!token.trim()) localStorage.removeItem(PAT_KEY)
    else localStorage.setItem(PAT_KEY, token.trim())
  } catch {
    /* ignore */
  }
}

export function parseGithubUrl(input: string): GitHubRemote | null {
  const trimmed = input.trim().replace(/\/$/, '')
  // https://github.com/owner/repo[/tree/branch[/path]]
  const m = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)(?:\/(.*))?)?/i,
  )
  if (m) {
    return {
      owner: m[1],
      repo: m[2].replace(/\.git$/, ''),
      branch: m[3] || 'main',
      pathPrefix: m[4] ? normalizePath(m[4]) : undefined,
    }
  }
  // owner/repo[@branch]
  const short = trimmed.match(/^([^/\s]+)\/([^/@\s]+)(?:@([^/\s]+))?$/)
  if (short) {
    return {
      owner: short[1],
      repo: short[2].replace(/\.git$/, ''),
      branch: short[3] || 'main',
    }
  }
  return null
}

function authHeaders(pat?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = pat?.trim() || loadGithubPat()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

type GhContentItem = {
  type: 'file' | 'dir' | string
  name: string
  path: string
  download_url?: string | null
  content?: string
  encoding?: string
  sha?: string
}

async function ghFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `GitHub API ${res.status}: ${text.slice(0, 200) || res.statusText}`,
    )
  }
  return res
}

async function listContents(
  remote: GitHubRemote,
  path: string,
  pat?: string,
): Promise<GhContentItem[]> {
  const q = remote.branch ? `?ref=${encodeURIComponent(remote.branch)}` : ''
  const url = `https://api.github.com/repos/${remote.owner}/${remote.repo}/contents/${path}${q}`
  const res = await ghFetch(url, { headers: authHeaders(pat) })
  const data = (await res.json()) as GhContentItem | GhContentItem[]
  return Array.isArray(data) ? data : [data]
}

async function collectFiles(
  remote: GitHubRemote,
  path: string,
  pat?: string,
  depth = 0,
): Promise<IdeFileNode[]> {
  if (depth > 8) return []
  const items = await listContents(remote, path, pat)
  const out: IdeFileNode[] = []
  for (const item of items) {
    const relBase = remote.pathPrefix
      ? item.path.replace(
          new RegExp(`^${remote.pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?`),
          '',
        )
      : item.path
    const rel = normalizePath(relBase)
    if (!rel) continue
    if (item.name === 'node_modules' || item.name === '.git') continue

    if (item.type === 'dir') {
      out.push({ path: rel, kind: 'folder', content: '' })
      out.push(...(await collectFiles(remote, item.path, pat, depth + 1)))
    } else if (item.type === 'file') {
      if (!/\.(ts|tsx|algo\.ts|json|md|teal|txt)$/i.test(item.name)) continue
      let content = ''
      if (item.download_url) {
        const r = await fetch(item.download_url, {
          headers: pat || loadGithubPat() ? authHeaders(pat) : {},
        })
        if (!r.ok) continue
        content = await r.text()
      } else if (item.content && item.encoding === 'base64') {
        content = atob(item.content.replace(/\n/g, ''))
      }
      if (content.length > 1_500_000) continue
      out.push({ path: rel, kind: 'file', content })
    }
  }
  return out
}

export async function importFromGithub(
  urlOrSlug: string,
  pat?: string,
): Promise<IdeProjectState> {
  const remote = parseGithubUrl(urlOrSlug)
  if (!remote) {
    throw new Error(
      'Unrecognized GitHub URL. Use https://github.com/owner/repo or owner/repo@branch',
    )
  }
  const startPath = remote.pathPrefix || ''
  const nodes = await collectFiles(remote, startPath, pat)
  if (nodes.filter((n) => n.kind === 'file').length === 0) {
    throw new Error('No importable source files found in that repository path')
  }

  let state = defaultProject()
  state = { ...state, files: [], activePath: '', name: remote.repo }
  for (const n of nodes) {
    if (n.kind === 'folder') {
      try {
        state = createFolder(state, n.path)
      } catch {
        /* exists */
      }
    } else {
      state = upsertFile(state, n.path, n.content)
    }
  }
  state.github = remote
  return state
}

/**
 * Push / update files on GitHub via Contents API.
 * Requires a PAT with `contents:write` (fine-grained) or `repo` (classic).
 */
export async function pushProjectToGithub(input: {
  project: IdeProjectState
  remote?: GitHubRemote
  pat?: string
  message?: string
}): Promise<{ pushed: number; remote: GitHubRemote }> {
  const remote = input.remote || input.project.github
  if (!remote) {
    throw new Error('No GitHub remote configured — import or set owner/repo first')
  }
  const pat = input.pat?.trim() || loadGithubPat()
  if (!pat) {
    throw new Error(
      'GitHub PAT required to push. Paste a token with contents:write (stored locally only).',
    )
  }

  let pushed = 0
  for (const f of input.project.files) {
    if (f.kind !== 'file') continue
    const remotePath = remote.pathPrefix
      ? `${remote.pathPrefix}/${f.path}`
      : f.path
    const apiPath = `https://api.github.com/repos/${remote.owner}/${remote.repo}/contents/${remotePath}`

    let sha: string | undefined
    try {
      const existing = await ghFetch(
        `${apiPath}?ref=${encodeURIComponent(remote.branch)}`,
        { headers: authHeaders(pat) },
      )
      const data = (await existing.json()) as { sha?: string }
      sha = data.sha
    } catch {
      /* new file */
    }

    const body = {
      message: input.message || `Update ${f.path} from Micropay IDE`,
      content: btoa(unescape(encodeURIComponent(f.content))),
      branch: remote.branch,
      ...(sha ? { sha } : {}),
    }
    await ghFetch(apiPath, {
      method: 'PUT',
      headers: {
        ...authHeaders(pat),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    pushed++
  }

  return { pushed, remote }
}

export const GITHUB_SETUP_NOTES = `Connect a GitHub repo from the IDE:
1. Create a personal access token with permission to read (import) and write (push) repository contents. For private repos, include repo access.
2. Paste the token here — it stays in this browser only and is never sent to Micropay servers.
3. Public repos can often be imported without a token (GitHub rate limits apply).
4. Push updates files on the linked branch; it does not open pull requests.`
