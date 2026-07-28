/**
 * Server-side Algorand TypeScript compilation via @algorandfoundation/puya-ts.
 * Supports multi-file projects: writes all sources into a temp workspace.
 */

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  compilePuyaTsSource,
  type CompileDiagnostic,
  type CompileMethod,
  type CompileResult,
} from '#/lib/puya-ts-compile'

const PROJECT_ROOT = process.cwd()

export type CompileProjectInput = {
  /** path → source contents */
  files: Record<string, string>
  /** Entry .algo.ts path within files (optional) */
  entry?: string
}

function extractMethods(source: string, contractName: string | null): CompileMethod[] {
  if (!contractName) return []
  const methodRe =
    /^\s*(?:public\s+|private\s+|protected\s+|override\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]|.\s]+))?\s*\{/gm
  const methods: CompileMethod[] = []
  let m: RegExpExecArray | null
  let line = 1
  let lastIndex = 0
  while ((m = methodRe.exec(source)) !== null) {
    const name = m[1]
    if (
      name === 'constructor' ||
      name === 'if' ||
      name === 'for' ||
      name === 'while' ||
      name === 'switch'
    ) {
      continue
    }
    for (let i = lastIndex; i < m.index; i++) {
      if (source[i] === '\n') line++
    }
    lastIndex = m.index
    const params = m[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    methods.push({
      name,
      params,
      returnType: (m[3] || 'void').trim(),
      line,
    })
  }
  return methods
}

function extractContractName(source: string): string | null {
  const match = source.match(
    /(?:export\s+)?class\s+(\w+)\s+extends\s+(?:Contract|BaseContract)\b/,
  )
  return match?.[1] ?? null
}

function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
}

function pickEntry(
  files: Record<string, string>,
  entry?: string,
): { path: string; source: string } {
  if (entry) {
    const n = normalizeRelPath(entry)
    if (files[n] !== undefined) return { path: n, source: files[n] }
  }
  const algo = Object.keys(files).find((p) => /\.algo\.ts$/i.test(p))
  if (algo) return { path: algo, source: files[algo] }
  const first = Object.keys(files)[0]
  if (!first) throw new Error('No source files provided')
  return { path: first, source: files[first] }
}

async function findTealArtifacts(
  outDir: string,
  contractName: string | null,
): Promise<{ approval: string | null; clear: string | null }> {
  let entries: string[] = []
  try {
    entries = await readdir(outDir)
  } catch {
    return { approval: null, clear: null }
  }

  const approvalName = contractName
    ? `${contractName}.approval.teal`
    : entries.find((e) => e.endsWith('.approval.teal'))
  const clearName = contractName
    ? `${contractName}.clear.teal`
    : entries.find((e) => e.endsWith('.clear.teal'))

  const approvalFile =
    typeof approvalName === 'string' && entries.includes(approvalName)
      ? approvalName
      : entries.find((e) => e.endsWith('.approval.teal'))
  const clearFile =
    typeof clearName === 'string' && entries.includes(clearName)
      ? clearName
      : entries.find((e) => e.endsWith('.clear.teal'))

  const [approval, clear] = await Promise.all([
    approvalFile
      ? readFile(join(outDir, approvalFile), 'utf8')
      : Promise.resolve(null),
    clearFile
      ? readFile(join(outDir, clearFile), 'utf8')
      : Promise.resolve(null),
  ])
  return { approval, clear }
}

async function writeProjectFiles(
  workDir: string,
  files: Record<string, string>,
): Promise<string[]> {
  const written: string[] = []
  for (const [rel, content] of Object.entries(files)) {
    const n = normalizeRelPath(rel)
    if (!n || n.includes('..')) continue
    const full = join(workDir, n)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, content, 'utf8')
    written.push(n)
  }
  return written
}

/**
 * Compile a multi-file Algorand TypeScript project with real puya-ts.
 * Falls back to structural stubs if puya-ts is unavailable or fails hard.
 */
export async function compilePuyaTsProjectWithPuya(
  input: CompileProjectInput,
): Promise<CompileResult> {
  const files: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.files || {})) {
    const n = normalizeRelPath(k)
    if (n && typeof v === 'string') files[n] = v
  }

  if (Object.keys(files).length === 0) {
    return compilePuyaTsSource('')
  }

  const { path: entryPath, source: entrySource } = pickEntry(files, input.entry)
  const structural = compilePuyaTsSource(entrySource)
  if (!structural.contractName && structural.diagnostics.some((d) => d.severity === 'error')) {
    return {
      ...structural,
      notes: [
        ...structural.notes,
        `Entry file: ${entryPath}`,
        `Project files: ${Object.keys(files).join(', ')}`,
      ],
    }
  }

  let workDir: string | null = null
  try {
    const baseTmp = join(PROJECT_ROOT, '.puya-tmp')
    await mkdir(baseTmp, { recursive: true })
    workDir = await mkdtemp(join(baseTmp, 'compile-'))
    const written = await writeProjectFiles(workDir, files)
    if (written.length === 0) {
      return compilePuyaTsSource(entrySource)
    }

    const puya = await import('@algorandfoundation/puya-ts')
    const {
      compile,
      CompileOptions,
      processInputPaths,
      LogLevel,
      LoggingContext,
    } = puya

    const ctx = LoggingContext.create()
    const compileOutcome = await ctx.run(async () => {
      const filePaths = processInputPaths({
        paths: [workDir!],
        outDir: 'out',
      })
      return compile(
        new CompileOptions({
          filePaths,
          outputTeal: true,
          outputArc32: true,
          outputArc56: false,
          outputBytecode: false,
          outputSourceMap: false,
          outputClient: false,
          dryRun: false,
          logLevel: LogLevel.Warning,
        }),
      )
    })

    const diagnostics: CompileDiagnostic[] = []
    for (const event of ctx.logEvents) {
      if (
        event.level !== LogLevel.Error &&
        event.level !== LogLevel.Critical &&
        event.level !== LogLevel.Warning
      ) {
        continue
      }
      const loc = event.sourceLocation
      diagnostics.push({
        severity: event.level === LogLevel.Warning ? 'warning' : 'error',
        message: event.message,
        line: loc?.line && loc.line > 0 ? loc.line : 1,
        column: loc?.column && loc.column > 0 ? loc.column : 1,
        endLine: loc?.endLine,
        endColumn: loc?.endColumn,
      })
    }

    const contractName =
      extractContractName(entrySource) ?? structural.contractName
    const methods =
      structural.methods.length > 0
        ? structural.methods
        : extractMethods(entrySource, contractName)

    const outDir = join(workDir, 'out')
    const { approval, clear } = await findTealArtifacts(outDir, contractName)
    const hasErrors =
      diagnostics.some((d) => d.severity === 'error') || ctx.hasErrors()

    const fileNote = `Compiled project (${written.length} file${written.length === 1 ? '' : 's'}); entry: ${entryPath}`

    if (!hasErrors && approval && clear) {
      return {
        ok: true,
        diagnostics,
        contractName,
        methods,
        approvalTeal: approval,
        clearTeal: clear,
        mode: 'puya-ts',
        notes: [
          'Compiled with @algorandfoundation/puya-ts (Puya backend).',
          fileNote,
        ],
      }
    }

    if (hasErrors) {
      return {
        ok: false,
        diagnostics: diagnostics.length
          ? diagnostics
          : [
              {
                severity: 'error',
                message: 'puya-ts compilation failed',
                line: 1,
                column: 1,
              },
            ],
        contractName,
        methods,
        approvalTeal: null,
        clearTeal: null,
        mode: 'puya-ts',
        notes: [
          'puya-ts reported errors. Fix diagnostics and compile again.',
          fileNote,
          `Compiler target: ${String(compileOutcome.programDirectory)}`,
        ],
      }
    }

    return {
      ...structural,
      diagnostics: [
        ...diagnostics,
        {
          severity: 'warning',
          message:
            'puya-ts did not emit TEAL artifacts; using structural stub instead',
          line: 1,
          column: 1,
        },
        ...structural.diagnostics,
      ],
      notes: [
        ...structural.notes,
        'Server attempted full puya-ts compile but artifacts were missing.',
        fileNote,
      ],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ...structural,
      diagnostics: [
        {
          severity: 'warning',
          message: `Full puya-ts compile unavailable (${message}); using structural stub`,
          line: 1,
          column: 1,
        },
        ...structural.diagnostics,
      ],
      notes: [
        ...structural.notes,
        'Install @algorandfoundation/puya-ts for real TEAL output on the server.',
        `Entry file: ${entryPath}`,
      ],
    }
  } finally {
    if (workDir) {
      try {
        await rm(workDir, { recursive: true, force: true })
      } catch {
        /* ignore cleanup errors */
      }
    }
  }
}

/** Back-compat single-source compile. */
export async function compilePuyaTsSourceWithPuya(
  source: string,
): Promise<CompileResult> {
  return compilePuyaTsProjectWithPuya({
    files: { 'contract.algo.ts': source },
    entry: 'contract.algo.ts',
  })
}
