/**
 * Client for POST /api/v1/ide/agent — tool-calling IDE agent loop.
 */

import { apiUrl } from '#/lib/api-url'
import type { CompileResult } from '#/lib/puya-ts-compile'
import { compilePuyaTsSource } from '#/lib/puya-ts-compile'
import {
  costUsdcFromTrace,
  providerLabelFromTrace,
  type ChatMessage,
} from '#/lib/micropay-api'
import { IDE_AGENT_TOOLS } from '#/lib/ide-knowledge'
import {
  createFolder,
  deletePath,
  getActiveFile,
  getFile,
  listFiles,
  pickEntryFile,
  renamePath,
  upsertFile,
  type IdeProjectState,
} from '#/lib/puya-ts-project'

export type IdeToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type IdeAgentMessage =
  | ChatMessage
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: IdeToolCall[]
    }
  | {
      role: 'tool'
      tool_call_id: string
      content: string
    }

export type IdeAgentTurnResult = {
  ok: boolean
  status: number
  content: string
  toolCalls: IdeToolCall[]
  messages: IdeAgentMessage[]
  costUsdc?: number
  provider?: string
  error?: string
  raw?: unknown
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

async function postIdeAgent(input: {
  model: string
  messages: IdeAgentMessage[]
  tools?: unknown[]
  fetchImpl?: typeof fetch | null
  signal?: AbortSignal
}): Promise<{
  ok: boolean
  status: number
  content: string
  toolCalls: IdeToolCall[]
  costUsdc?: number
  provider?: string
  error?: string
  raw?: unknown
  assistantMessage: IdeAgentMessage | null
}> {
  const f = input.fetchImpl ?? fetch
  const res = await f(apiUrl('/api/v1/ide/agent'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: false,
      ...(input.tools ? { tools: input.tools } : {}),
    }),
    signal: input.signal,
  })

  const raw = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      isRecord(raw) &&
      isRecord(raw.error) &&
      typeof raw.error.message === 'string'
        ? raw.error.message
        : `IDE agent failed (${res.status})`
    return {
      ok: false,
      status: res.status,
      content: '',
      toolCalls: [],
      error: err,
      raw,
      assistantMessage: null,
    }
  }

  const choice = isRecord(raw)
    ? (raw.choices as Array<Record<string, unknown>> | undefined)?.[0]
    : undefined
  const message = choice && isRecord(choice.message) ? choice.message : null
  const content =
    message && typeof message.content === 'string' ? message.content : ''
  const toolCallsRaw = message?.tool_calls
  const toolCalls: IdeToolCall[] = Array.isArray(toolCallsRaw)
    ? (toolCallsRaw as IdeToolCall[])
    : []

  const trace =
    isRecord(raw) && isRecord(raw.x_0g_trace)
      ? (raw.x_0g_trace as Record<string, unknown>)
      : undefined

  const assistantMessage: IdeAgentMessage = {
    role: 'assistant',
    content: content || null,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  }

  return {
    ok: true,
    status: res.status,
    content,
    toolCalls,
    costUsdc: costUsdcFromTrace(trace),
    provider: providerLabelFromTrace(trace),
    raw,
    assistantMessage,
  }
}

export type IdeToolExecutor = {
  getProject: () => IdeProjectState
  setProject: (next: IdeProjectState) => void
  compile: (entry?: string) => Promise<CompileResult>
  lastCompile: () => CompileResult | null
  onTool?: (name: string, detail: string) => void
}

export async function executeIdeTool(
  name: string,
  argsJson: string,
  exec: IdeToolExecutor,
): Promise<string> {
  let args: Record<string, unknown> = {}
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>
  } catch {
    return JSON.stringify({ error: 'Invalid tool arguments JSON' })
  }

  try {
    const project = exec.getProject()
    switch (name) {
      case 'list_files': {
        const files = listFiles(project).map((f) => ({
          path: f.path,
          kind: f.kind,
          bytes: f.kind === 'file' ? f.content.length : 0,
        }))
        exec.onTool?.(name, `${files.length} paths`)
        return JSON.stringify({ files })
      }
      case 'get_active_file': {
        const f = getActiveFile(project)
        exec.onTool?.(name, f?.path || '(none)')
        return JSON.stringify(
          f
            ? { path: f.path, content: f.content }
            : { error: 'No active file' },
        )
      }
      case 'read_file': {
        const path = String(args.path || '')
        const f = getFile(project, path)
        exec.onTool?.(name, path)
        if (!f || f.kind !== 'file') {
          return JSON.stringify({ error: `File not found: ${path}` })
        }
        return JSON.stringify({ path: f.path, content: f.content })
      }
      case 'write_file': {
        const path = String(args.path || '')
        const content = String(args.content ?? '')
        const next = upsertFile(project, path, content)
        exec.setProject(next)
        exec.onTool?.(name, path)
        return JSON.stringify({ ok: true, path })
      }
      case 'create_folder': {
        const path = String(args.path || '')
        const next = createFolder(project, path)
        exec.setProject(next)
        exec.onTool?.(name, path)
        return JSON.stringify({ ok: true, path })
      }
      case 'delete_path': {
        const path = String(args.path || '')
        const next = deletePath(project, path)
        exec.setProject(next)
        exec.onTool?.(name, path)
        return JSON.stringify({ ok: true, path })
      }
      case 'rename_path': {
        const from = String(args.from || '')
        const to = String(args.to || '')
        const next = renamePath(project, from, to)
        exec.setProject(next)
        exec.onTool?.(name, `${from} → ${to}`)
        return JSON.stringify({ ok: true, from, to })
      }
      case 'compile_project': {
        const entry =
          typeof args.entry === 'string' ? args.entry : undefined
        exec.onTool?.(name, entry || pickEntryFile(project))
        const result = await exec.compile(entry)
        return JSON.stringify({
          ok: result.ok,
          mode: result.mode,
          contractName: result.contractName,
          methods: result.methods,
          diagnostics: result.diagnostics,
          notes: result.notes,
          hasApprovalTeal: Boolean(result.approvalTeal),
          hasClearTeal: Boolean(result.clearTeal),
        })
      }
      case 'list_methods': {
        const entry =
          typeof args.entry === 'string'
            ? args.entry
            : pickEntryFile(project)
        const last = exec.lastCompile()
        if (last?.methods?.length) {
          exec.onTool?.(name, `${last.methods.length} from last compile`)
          return JSON.stringify({
            contractName: last.contractName,
            methods: last.methods,
            source: 'last_compile',
          })
        }
        const file = getFile(project, entry)
        const structural = compilePuyaTsSource(file?.content || '')
        exec.onTool?.(name, entry)
        return JSON.stringify({
          contractName: structural.contractName,
          methods: structural.methods,
          source: 'structural',
          entry,
        })
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * Run the IDE agent until it stops requesting tools (maxRounds).
 * Each model call is billed via /api/v1/ide/agent on the API host
 * (`VITE_PUBLIC_API_URL` → app bridge). App records Activity type "IDE".
 */
export async function runIdeAgentLoop(input: {
  model: string
  userMessages: ChatMessage[]
  projectSummary: string
  exec: IdeToolExecutor
  fetchImpl?: typeof fetch | null
  signal?: AbortSignal
  maxRounds?: number
  onAssistantDelta?: (text: string) => void
  onTool?: (name: string, detail: string) => void
}): Promise<IdeAgentTurnResult> {
  const maxRounds = input.maxRounds ?? 8
  const messages: IdeAgentMessage[] = [
    {
      role: 'system',
      content: `Current IDE project snapshot:\n${input.projectSummary}`,
    },
    ...input.userMessages,
  ]

  let lastContent = ''
  let totalCost = 0
  let lastProvider: string | undefined
  let lastStatus = 200
  let lastRaw: unknown

  const exec: IdeToolExecutor = {
    ...input.exec,
    onTool: (name, detail) => {
      input.onTool?.(name, detail)
      input.exec.onTool?.(name, detail)
    },
  }

  for (let round = 0; round < maxRounds; round++) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        status: lastStatus,
        content: lastContent || '(stopped)',
        toolCalls: [],
        messages,
        costUsdc: totalCost || undefined,
        provider: lastProvider,
        error: 'aborted',
      }
    }

    const turn = await postIdeAgent({
      model: input.model,
      messages,
      tools: IDE_AGENT_TOOLS,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
    })
    lastStatus = turn.status
    lastRaw = turn.raw
    if (turn.costUsdc) totalCost += turn.costUsdc
    if (turn.provider) lastProvider = turn.provider

    if (!turn.ok || !turn.assistantMessage) {
      return {
        ok: false,
        status: turn.status,
        content: '',
        toolCalls: [],
        messages,
        costUsdc: totalCost || undefined,
        provider: lastProvider,
        error: turn.error || 'IDE agent request failed',
        raw: turn.raw,
      }
    }

    messages.push(turn.assistantMessage)
    if (turn.content) {
      lastContent = turn.content
      input.onAssistantDelta?.(turn.content)
    }

    if (!turn.toolCalls.length) {
      return {
        ok: true,
        status: turn.status,
        content: lastContent,
        toolCalls: [],
        messages,
        costUsdc: totalCost || undefined,
        provider: lastProvider,
        raw: lastRaw,
      }
    }

    for (const tc of turn.toolCalls) {
      const result = await executeIdeTool(
        tc.function.name,
        tc.function.arguments,
        exec,
      )
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      })
    }
  }

  return {
    ok: true,
    status: lastStatus,
    content: lastContent || 'Reached tool round limit — compile or ask to continue.',
    toolCalls: [],
    messages,
    costUsdc: totalCost || undefined,
    provider: lastProvider,
    raw: lastRaw,
  }
}

export function summarizeProjectForAgent(project: IdeProjectState): string {
  const lines = [
    `name: ${project.name}`,
    `activePath: ${project.activePath}`,
    'files:',
  ]
  for (const f of listFiles(project)) {
    if (f.kind === 'folder') {
      lines.push(`  [dir] ${f.path}/`)
    } else {
      const preview = f.content.slice(0, 400).replace(/\n/g, '\\n')
      lines.push(
        `  [file] ${f.path} (${f.content.length} chars) preview: ${preview}${f.content.length > 400 ? '…' : ''}`,
      )
    }
  }
  return lines.join('\n')
}
