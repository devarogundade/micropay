import Editor, { type OnMount } from '@monaco-editor/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import type { CompileDiagnostic } from '#/lib/puya-ts-compile'

type Props = {
  value: string
  onChange: (value: string) => void
  diagnostics?: CompileDiagnostic[]
  filename?: string
}

export type PuyaTsEditorHandle = {
  undo: () => void
  redo: () => void
  /** Replace buffer via Monaco edits so Ctrl+Z / undo can reverse it. */
  applyValue: (next: string) => void
  focus: () => void
}

const PUYA_TS_EXTRA_LIBS = `
declare type uint64 = number & { __uint64?: never }
declare type biguint = bigint & { __biguint?: never }
declare type bytes = Uint8Array & { __bytes?: never }

declare class Contract {
  approvalProgram(): boolean | uint64
  clearStateProgram(): boolean | uint64
}

declare class BaseContract {
  approvalProgram(): boolean | uint64
  clearStateProgram(): boolean | uint64
}

declare function GlobalState<T>(opts?: { key?: string; initialValue?: T }): {
  value: T
  hasValue: boolean
  delete(): void
}

declare function LocalState<T>(opts?: { key?: string }): {
  (account: unknown): { value: T; hasValue: boolean; delete(): void }
}

declare function Box<T>(opts: { key: string | bytes }): {
  value: T
  exists: boolean
  create(opts?: { size?: uint64 }): boolean
  delete(): boolean
}

declare module '@algorandfoundation/algorand-typescript' {
  export { Contract, BaseContract, GlobalState, LocalState, Box }
  export type { uint64, biguint, bytes }
}
`

function severityToMarker(
  severity: CompileDiagnostic['severity'],
  monaco: typeof import('monaco-editor'),
) {
  return severity === 'error'
    ? monaco.MarkerSeverity.Error
    : monaco.MarkerSeverity.Warning
}

export const PuyaTsEditor = forwardRef<PuyaTsEditorHandle, Props>(
  function PuyaTsEditor(
    { value, onChange, diagnostics = [], filename = 'contract.algo.ts' },
    ref,
  ) {
    const [mounted, setMounted] = useState(false)
    const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
    const editorRef = useRef<
      import('monaco-editor').editor.IStandaloneCodeEditor | null
    >(null)
    const libsReady = useRef(false)
    const applyingRef = useRef(false)

    useEffect(() => {
      setMounted(true)
    }, [])

    useImperativeHandle(ref, () => ({
      undo: () => {
        editorRef.current?.trigger('toolbar', 'undo', null)
      },
      redo: () => {
        editorRef.current?.trigger('toolbar', 'redo', null)
      },
      applyValue: (next: string) => {
        const editor = editorRef.current
        const model = editor?.getModel()
        if (!editor || !model) {
          onChange(next)
          return
        }
        if (model.getValue() === next) return
        applyingRef.current = true
        editor.pushUndoStop()
        editor.executeEdits('ai-apply', [
          {
            range: model.getFullModelRange(),
            text: next,
          },
        ])
        editor.pushUndoStop()
        applyingRef.current = false
        onChange(next)
      },
      focus: () => {
        editorRef.current?.focus()
      },
    }))

    const applyMarkers = useCallback(() => {
      const monaco = monacoRef.current
      const editor = editorRef.current
      if (!monaco || !editor) return
      const model = editor.getModel()
      if (!model) return
      monaco.editor.setModelMarkers(
        model,
        'puya-ts',
        diagnostics.map((d) => ({
          startLineNumber: d.line,
          startColumn: d.column,
          endLineNumber: d.endLine ?? d.line,
          endColumn: d.endColumn ?? d.column + 1,
          message: d.message,
          severity: severityToMarker(d.severity, monaco),
        })),
      )
    }, [diagnostics])

    useEffect(() => {
      applyMarkers()
    }, [applyMarkers])

    const onMount: OnMount = (editor, monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco

      monaco.editor.defineTheme('micropay-void', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '62666d' },
          { token: 'string', foreground: '02b8cc' },
          { token: 'number', foreground: 'e4f222' },
          { token: 'keyword', foreground: 'd0d6e0' },
          { token: 'type', foreground: '09c72b' },
        ],
        colors: {
          'editor.background': '#08090a',
          'editor.foreground': '#d0d6e0',
          'editorLineNumber.foreground': '#62666d',
          'editorLineNumber.activeForeground': '#8a8f98',
          'editor.selectionBackground': '#23252a',
          'editor.lineHighlightBackground': '#0f1011',
          'editorCursor.foreground': '#e4f222',
          'editorWidget.background': '#0f1011',
          'editorWidget.border': '#23252a',
          'scrollbarSlider.background': '#23252a88',
        },
      })
      monaco.editor.setTheme('micropay-void')

      if (!libsReady.current) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          target: monaco.languages.typescript.ScriptTarget.ES2020,
          allowNonTsExtensions: true,
          moduleResolution:
            monaco.languages.typescript.ModuleResolutionKind.NodeJs,
          module: monaco.languages.typescript.ModuleKind.ESNext,
          noEmit: true,
          esModuleInterop: true,
          strict: false,
        })
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        })
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          PUYA_TS_EXTRA_LIBS,
          'file:///puya-ts-shims.d.ts',
        )
        libsReady.current = true
      }

      applyMarkers()
    }

    if (!mounted) {
      return (
        <div className="flex h-full min-h-0 w-full items-center justify-center bg-void text-xs text-fog">
          Loading editor…
        </div>
      )
    }

    return (
      <div className="h-full min-h-0 w-full overflow-hidden bg-void">
        <Editor
          height="100%"
          path={filename}
          language="typescript"
          theme="micropay-void"
          value={value}
          onChange={(v) => {
            if (applyingRef.current) return
            onChange(v ?? '')
          }}
          onMount={onMount}
          loading={
            <div className="flex h-full items-center justify-center text-xs text-fog">
              Loading editor…
            </div>
          }
          options={{
            fontFamily:
              'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 13,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
          }}
        />
      </div>
    )
  },
)
