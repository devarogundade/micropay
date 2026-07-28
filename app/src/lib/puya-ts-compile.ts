/**
 * Structural Algorand TypeScript (puya-ts) validation + minimal TEAL stubs.
 *
 * The browser uses this for offline/fallback checks. The API route prefers
 * full `@algorandfoundation/puya-ts` compilation via `puya-ts-compile.server.ts`.
 */

export type CompileDiagnostic = {
  severity: 'error' | 'warning'
  message: string
  line: number
  column: number
  endLine?: number
  endColumn?: number
}

export type CompileMethod = {
  name: string
  params: string[]
  returnType: string
  line: number
}

export type CompileResult = {
  ok: boolean
  diagnostics: CompileDiagnostic[]
  contractName: string | null
  methods: CompileMethod[]
  approvalTeal: string | null
  clearTeal: string | null
  mode: 'structural' | 'puya-ts'
  notes: string[]
}

function lineCol(source: string, index: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

function pushDiag(
  list: CompileDiagnostic[],
  source: string,
  index: number,
  message: string,
  severity: CompileDiagnostic['severity'] = 'error',
) {
  const { line, column } = lineCol(source, index)
  list.push({ severity, message, line, column })
}

const UNSUPPORTED = [
  { re: /\basync\b/, msg: 'async/await is not supported in Algorand TypeScript' },
  { re: /\bawait\b/, msg: 'await is not supported in Algorand TypeScript' },
  { re: /\bPromise\b/, msg: 'Promises are not supported in Algorand TypeScript' },
  { re: /\bconsole\s*\./, msg: 'console.* is not available on the AVM' },
  { re: /\bwindow\b/, msg: 'Browser globals are not available in Algorand TypeScript' },
  { re: /\bdocument\b/, msg: 'DOM APIs are not available in Algorand TypeScript' },
  { re: /\bfetch\s*\(/, msg: 'fetch() is not available in Algorand TypeScript' },
  { re: /\brequire\s*\(/, msg: 'CommonJS require() is not supported in Algorand TypeScript' },
]

/** Sync structural checks — safe for browser and as a server fallback. */
export function compilePuyaTsSource(source: string): CompileResult {
  const diagnostics: CompileDiagnostic[] = []
  const notes: string[] = [
    'Structural compile checks Algorand TypeScript shape and emits a minimal deployable TEAL stub.',
    'Production contracts should be compiled with `npx puya-ts build` / AlgoKit for full TEAL + ARC artifacts.',
  ]

  const trimmed = source.trim()
  if (!trimmed) {
    diagnostics.push({
      severity: 'error',
      message: 'Source is empty',
      line: 1,
      column: 1,
    })
    return emptyFail(diagnostics, notes)
  }

  const hasAlgoTsImport =
    /from\s+['"]@algorandfoundation\/algorand-typescript(?:\/[^'"]*)?['"]/.test(
      source,
    )
  const hasLegacyTealscriptImport =
    /from\s+['"]@algorandfoundation\/tealscript['"]/.test(source) ||
    /from\s+['"][^'"]*tealscript[^'"]*['"]/.test(source)

  if (hasLegacyTealscriptImport && !hasAlgoTsImport) {
    const idx = source.indexOf('tealscript')
    pushDiag(
      diagnostics,
      source,
      idx >= 0 ? idx : 0,
      'TEALScript is deprecated — import from @algorandfoundation/algorand-typescript (puya-ts)',
    )
  } else if (!hasAlgoTsImport) {
    const idx = source.indexOf('import')
    pushDiag(
      diagnostics,
      source,
      idx >= 0 ? idx : 0,
      'Expected an import from @algorandfoundation/algorand-typescript',
    )
  }

  const classMatch = source.match(
    /(?:export\s+)?class\s+(\w+)\s+extends\s+(?:Contract|BaseContract)\b/,
  )
  if (!classMatch || classMatch.index === undefined) {
    pushDiag(
      diagnostics,
      source,
      0,
      'Expected a class that extends Contract or BaseContract (e.g. class MyApp extends Contract)',
    )
    return emptyFail(diagnostics, notes)
  }

  const contractName = classMatch[1]
  const classStart = classMatch.index

  for (const rule of UNSUPPORTED) {
    const m = rule.re.exec(source)
    if (m && m.index !== undefined) {
      pushDiag(diagnostics, source, m.index, rule.msg)
    }
  }

  const methodRe =
    /^\s*(?:public\s+|private\s+|protected\s+|override\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>\[\]|.\s]+))?\s*\{/gm
  const methods: CompileMethod[] = []
  let m: RegExpExecArray | null
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
    const { line } = lineCol(source, m.index)
    const params = m[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    const returnType = (m[3] || 'void').trim()
    methods.push({ name, params, returnType, line })

    for (const p of params) {
      if (p && !p.includes(':')) {
        pushDiag(
          diagnostics,
          source,
          m.index,
          `Parameter "${p.split('=')[0].trim()}" in ${name}() should have an explicit Algorand TypeScript type`,
          'warning',
        )
      }
    }
  }

  if (methods.length === 0) {
    pushDiag(
      diagnostics,
      source,
      classStart,
      `No methods found on ${contractName}. Add at least one typed method.`,
      'warning',
    )
  }

  let depth = 0
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth < 0) {
      pushDiag(diagnostics, source, i, 'Unbalanced closing brace')
      break
    }
  }
  if (depth > 0) {
    pushDiag(
      diagnostics,
      source,
      source.length - 1,
      'Unbalanced opening brace — missing }',
    )
  }

  const errors = diagnostics.filter((d) => d.severity === 'error')
  if (errors.length > 0) {
    return {
      ok: false,
      diagnostics,
      contractName,
      methods,
      approvalTeal: null,
      clearTeal: null,
      mode: 'structural',
      notes,
    }
  }

  const approvalTeal = buildApprovalTeal(contractName, methods)
  const clearTeal = `#pragma version 11
// Clear state program for ${contractName}
int 1
`

  notes.push(
    `Detected ${methods.length} method(s) on ${contractName}. Stub TEAL always approves create/NoOp; replace with AlgoKit / puya-ts artifacts before mainnet.`,
  )

  return {
    ok: true,
    diagnostics,
    contractName,
    methods,
    approvalTeal,
    clearTeal,
    mode: 'structural',
    notes,
  }
}

function emptyFail(
  diagnostics: CompileDiagnostic[],
  notes: string[],
): CompileResult {
  return {
    ok: false,
    diagnostics,
    contractName: null,
    methods: [],
    approvalTeal: null,
    clearTeal: null,
    mode: 'structural',
    notes,
  }
}

function buildApprovalTeal(contractName: string, methods: CompileMethod[]): string {
  const methodComments = methods
    .map(
      (m) =>
        `//   ${m.name}(${m.params.join(', ')}): ${m.returnType}  (src L${m.line})`,
    )
    .join('\n')

  return `#pragma version 11
// Structural stub for Algorand TypeScript (puya-ts) contract: ${contractName}
// Methods detected:
${methodComments || '//   (none)'}
//
// This is NOT full puya-ts output. Use AlgoKit / npx puya-ts build for production.

txn ApplicationID
bz create

txn OnCompletion
int NoOp
==
bnz handle_noop

txn OnCompletion
int DeleteApplication
==
bnz handle_delete

txn OnCompletion
int UpdateApplication
==
bnz handle_update

err

create:
int 1
return

handle_noop:
int 1
return

handle_delete:
int 1
return

handle_update:
int 0
return
`
}
