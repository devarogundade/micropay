import { Link } from '@tanstack/react-router'
import {
  Braces,
  CircleAlert,
  Download,
  FileCode2,
  FolderOpen,
  Github,
  History,
  Loader2,
  LogOut,
  Play,
  Redo2,
  Rocket,
  Save,
  Undo2,
  Upload,
  Wallet,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { toast } from 'sonner'

import { BrandMark } from '#/components/brand'
import { ModelSwitcher } from '#/components/models/model-switcher'
import {
  getSkipPayConfirm,
  PayConfirmDialog,
} from '#/components/pay-confirm-dialog'
import {
  IdeFileTree,
  IdePathPrompt,
  fileCountLabel,
} from '#/components/puya-ts/ide-file-tree'
import { IdeMethodCallPanel } from '#/components/puya-ts/ide-method-call-panel'
import { PuyaTsChatPanel } from '#/components/puya-ts/puya-ts-chat-panel'
import {
  defaultDeployNetwork,
  DEPLOY_NETWORKS,
  deployNetworkLabel,
  deployStubApplication,
  type DeployNetwork,
} from '#/components/puya-ts/puya-ts-deploy'
import {
  PuyaTsEditor,
  type PuyaTsEditorHandle,
} from '#/components/puya-ts/puya-ts-editor'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { EmptyState } from '#/components/ui/empty-state'
import { Input } from '#/components/ui/input'
import { ScrollArea } from '#/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Textarea } from '#/components/ui/textarea'
import { formatUsdc, sortModelsGptFirst, type Model } from '#/data/models'
import {
  downloadProjectJson,
  downloadProjectZip,
  loadProjectFromDirectory,
  loadProjectFromFileListAsync,
  loadProjectFromJson,
  loadProjectFromZip,
  saveProjectToDirectory,
} from '#/lib/ide-backup'
import {
  GITHUB_SETUP_NOTES,
  importFromGithub,
  loadGithubPat,
  parseGithubUrl,
  pushProjectToGithub,
  saveGithubPat,
} from '#/lib/ide-github'
import {
  compilePuyaTsSource,
  type CompileResult,
} from '#/lib/puya-ts-compile'
import {
  compileFileMap,
  createFolder,
  defaultProject,
  deletePath,
  getActiveFile,
  joinPath,
  loadIdeProject,
  pickEntryFile,
  renamePath,
  restoreProjectVersion,
  saveIdeProject,
  setActivePath,
  snapshotProject,
  updateActiveContent,
  upsertFile,
  type IdeProjectState,
} from '#/lib/puya-ts-project'
import { useClientGsap } from '#/lib/use-client-gsap'
import { cn } from '#/lib/utils'
import { useWallet } from '#/lib/wallet'

const LAYOUT_KEY = 'micropay.puya-ts.ide.layout.v1'
const NETWORK_KEY = 'micropay.puya-ts.ide.network.v1'
const APP_ID_KEY = 'micropay.puya-ts.ide.appid.v1'

type TerminalTab = 'problems' | 'artifacts' | 'call'

type LayoutState = {
  chatPct: number
  terminalH: number
  sidebarW: number
}

const DEFAULT_LAYOUT: LayoutState = {
  chatPct: 50,
  terminalH: 240,
  sidebarW: 220,
}

type PathDialog =
  | { kind: 'file'; parent: string }
  | { kind: 'folder'; parent: string }
  | { kind: 'rename'; path: string }
  | null

function loadLayout(): LayoutState {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) as Partial<LayoutState>
    return {
      chatPct: clamp(Number(parsed.chatPct) || DEFAULT_LAYOUT.chatPct, 25, 70),
      terminalH: clamp(
        Number(parsed.terminalH) || DEFAULT_LAYOUT.terminalH,
        120,
        520,
      ),
      sidebarW: clamp(
        Number(parsed.sidebarW) || DEFAULT_LAYOUT.sidebarW,
        160,
        360,
      ),
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

function saveLayout(layout: LayoutState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
  } catch {
    /* ignore */
  }
}

function loadNetwork(): DeployNetwork {
  if (typeof window === 'undefined') return defaultDeployNetwork()
  try {
    const raw = localStorage.getItem(NETWORK_KEY)
    if (raw && (DEPLOY_NETWORKS as string[]).includes(raw)) {
      return raw as DeployNetwork
    }
  } catch {
    /* ignore */
  }
  return defaultDeployNetwork()
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function useVerticalResize(onResize: (delta: number) => void) {
  return useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      let lastX = e.clientX
      const onMove = (ev: MouseEvent) => {
        onResize(ev.clientX - lastX)
        lastX = ev.clientX
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onResize],
  )
}

function useHorizontalResize(onResize: (delta: number) => void) {
  return useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      let lastY = e.clientY
      const onMove = (ev: MouseEvent) => {
        onResize(ev.clientY - lastY)
        lastY = ev.clientY
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [onResize],
  )
}

export function PuyaTsIde({ models }: { models: Model[] }) {
  // IDE-only: GPT / OpenAI first in picker + default; models browse keeps its own sort.
  const chatModels = useMemo(
    () => sortModelsGptFirst(models.filter((m) => m.type === 'Chat')),
    [models],
  )
  const [modelSlug, setModelSlug] = useState(chatModels[0]?.slug ?? '')
  const model =
    chatModels.find((m) => m.slug === modelSlug) ?? chatModels[0] ?? null

  const [project, setProject] = useState<IdeProjectState>(() => defaultProject())
  const projectRef = useRef(project)
  projectRef.current = project
  const [hydrated, setHydrated] = useState(false)
  const [compileResult, setCompileResult] = useState<CompileResult | null>(null)
  const compileRef = useRef<CompileResult | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployOpen, setDeployOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [githubOpen, setGithubOpen] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubPat, setGithubPat] = useState('')
  const [githubBusy, setGithubBusy] = useState(false)
  const [pathDialog, setPathDialog] = useState<PathDialog>(null)
  const [terminalTab, setTerminalTab] = useState<TerminalTab>('problems')
  const [chatBusy, setChatBusy] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [network, setNetwork] = useState<DeployNetwork>('mainnet')
  const [deployedAppId, setDeployedAppId] = useState('')
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT)
  const pendingRef = useRef<null | (() => Promise<void>)>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<PuyaTsEditorHandle>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const {
    account,
    shortAddress,
    setConnectOpen,
    disconnect,
    fetchWithPay,
    signTransactions,
  } = useWallet()

  const active = getActiveFile(project)
  const filename = active?.path ?? 'untitled.algo.ts'
  const source = active?.content ?? ''

  useEffect(() => {
    const state = loadIdeProject()
    setProject(state)
    setLayout(loadLayout())
    setNetwork(loadNetwork())
    setGithubPat(loadGithubPat())
    try {
      setDeployedAppId(localStorage.getItem(APP_ID_KEY) || '')
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveIdeProject(project), 400)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [project, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (layoutTimer.current) clearTimeout(layoutTimer.current)
    layoutTimer.current = setTimeout(() => saveLayout(layout), 200)
    return () => {
      if (layoutTimer.current) clearTimeout(layoutTimer.current)
    }
  }, [layout, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(NETWORK_KEY, network)
    } catch {
      /* ignore */
    }
  }, [network, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(APP_ID_KEY, deployedAppId)
    } catch {
      /* ignore */
    }
  }, [deployedAppId, hydrated])

  useClientGsap(rootRef, (gsap) => {
    gsap.from('.ws-body', {
      opacity: 0,
      y: 8,
      duration: 0.45,
      ease: 'power2.out',
    })
  })

  const onSidebarDrag = useVerticalResize((dx) => {
    setLayout((prev) => ({
      ...prev,
      sidebarW: clamp(prev.sidebarW + dx, 160, 360),
    }))
  })

  const onChatDrag = useVerticalResize((dx) => {
    setLayout((prev) => {
      const next = prev.chatPct - (dx / (window.innerWidth || 1)) * 100
      return { ...prev, chatPct: clamp(next, 25, 70) }
    })
  })

  const onTerminalDrag = useHorizontalResize((dy) => {
    setLayout((prev) => ({
      ...prev,
      terminalH: clamp(prev.terminalH - dy, 120, 520),
    }))
  })

  function runPaidAction(action: () => Promise<void>) {
    setPayOpen(false)
    setConfirming(true)
    void action()
      .catch(() => {})
      .finally(() => setConfirming(false))
  }

  function requestPay(action: () => Promise<void>) {
    if (!account || !fetchWithPay) {
      setConnectOpen(true)
      toast.message('Connect a wallet to pay')
      return
    }
    if (getSkipPayConfirm()) {
      runPaidAction(action)
      return
    }
    pendingRef.current = action
    setPayOpen(true)
  }

  function onSourceChange(next: string) {
    setProject((prev) => updateActiveContent(prev, next))
  }

  async function runCompile(entry?: string): Promise<CompileResult> {
    setCompiling(true)
    const current = projectRef.current
    const files = compileFileMap(current)
    const entryPath = pickEntryFile(current, entry)
    try {
      const res = await fetch('/api/v1/puya-ts/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, entry: entryPath }),
      })
      const raw: unknown = await res.json()
      if (raw && typeof raw === 'object' && 'error' in raw && !('ok' in raw)) {
        const err = (raw as { error?: { message?: string } }).error
        throw new Error(err?.message || 'Compile request failed')
      }
      const data = raw as CompileResult
      setCompileResult(data)
      compileRef.current = data
      if (data.ok) {
        toast.success(
          data.mode === 'puya-ts'
            ? 'Compile succeeded'
            : 'Compile passed (preview)',
        )
        setTerminalTab('artifacts')
        setProject((prev) =>
          snapshotProject(prev, `Compile · ${data.contractName ?? 'contract'}`),
        )
      } else {
        toast.error('Compile found errors')
        setTerminalTab('problems')
      }
      return data
    } catch (e) {
      const entrySource =
        files[entryPath] || getActiveFile(current)?.content || ''
      const local = compilePuyaTsSource(entrySource)
      setCompileResult(local)
      compileRef.current = local
      if (local.ok) {
        toast.success('Compile passed (local preview)')
        setTerminalTab('artifacts')
      } else {
        toast.error(e instanceof Error ? e.message : 'Compile failed')
        setTerminalTab('problems')
      }
      return local
    } finally {
      setCompiling(false)
    }
  }

  function saveSnapshot() {
    setProject((prev) => {
      const snapped = snapshotProject(prev, 'Manual save')
      saveIdeProject(snapped)
      return snapped
    })
    toast.success('Saved project snapshot')
  }

  async function confirmDeploy() {
    if (!compileResult?.ok || !compileResult.approvalTeal || !compileResult.clearTeal) {
      toast.error('Compile successfully before deploying')
      return
    }
    if (!account) {
      setConnectOpen(true)
      toast.message('Connect a wallet to deploy')
      return
    }
    setDeploying(true)
    try {
      const result = await deployStubApplication({
        approvalTeal: compileResult.approvalTeal,
        clearTeal: compileResult.clearTeal,
        sender: account.address,
        network,
        signTransactions,
      })
      setDeployOpen(false)
      setDeployedAppId(String(result.appId))
      setTerminalTab('call')
      toast.success(`Deployed app ${result.appId}`, {
        action:
          result.network === 'localnet'
            ? undefined
            : {
                label: 'Explorer',
                onClick: () => window.open(result.explorerUrl, '_blank'),
              },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deploy failed')
    } finally {
      setDeploying(false)
    }
  }

  function handlePathDialog(value: string) {
    if (!pathDialog || !value) {
      setPathDialog(null)
      return
    }
    try {
      if (pathDialog.kind === 'file') {
        const path = joinPath(pathDialog.parent, value)
        setProject((prev) => upsertFile(prev, path, ''))
        toast.success(`Created ${path}`)
      } else if (pathDialog.kind === 'folder') {
        const path = joinPath(pathDialog.parent, value)
        setProject((prev) => createFolder(prev, path))
        toast.success(`Created folder ${path}`)
      } else if (pathDialog.kind === 'rename') {
        setProject((prev) => renamePath(prev, pathDialog.path, value))
        toast.success(`Renamed to ${value}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
    setPathDialog(null)
  }

  async function handleGithubImport() {
    setGithubBusy(true)
    try {
      if (githubPat.trim()) saveGithubPat(githubPat.trim())
      const next = await importFromGithub(githubUrl, githubPat.trim() || undefined)
      setProject(next)
      setGithubOpen(false)
      toast.success(`Imported ${next.name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'GitHub import failed')
    } finally {
      setGithubBusy(false)
    }
  }

  async function handleGithubPush() {
    setGithubBusy(true)
    try {
      if (githubPat.trim()) saveGithubPat(githubPat.trim())
      const remote =
        project.github ||
        parseGithubUrl(githubUrl) ||
        undefined
      const { pushed, remote: used } = await pushProjectToGithub({
        project,
        remote: remote || undefined,
        pat: githubPat.trim() || undefined,
      })
      setProject((prev) => ({ ...prev, github: used }))
      toast.success(`Pushed ${pushed} file(s) to ${used.owner}/${used.repo}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'GitHub push failed')
    } finally {
      setGithubBusy(false)
    }
  }

  const problemCount =
    compileResult?.diagnostics.filter((d) => d.severity === 'error').length ?? 0
  const warningCount =
    compileResult?.diagnostics.filter((d) => d.severity === 'warning').length ??
    0

  if (!model) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          title="No chat models available"
          description="The IDE needs at least one chat model for the assistant."
        />
      </div>
    )
  }

  const editorColumnPct = 100 - layout.chatPct

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-void">
      <div className="ws-body flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="hidden min-h-0 shrink-0 flex-col border-r border-border bg-carbon md:flex"
          style={{ width: layout.sidebarW }}
        >
          <div className="workspace-bar flex items-center gap-2 border-b border-border px-3">
            <Link to="/models" className="min-w-0 no-underline">
              <BrandMark size="sm" />
            </Link>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-fog">
              Explorer
            </p>
            <span className="text-[10px] text-fog">
              {fileCountLabel(project.files)}
            </span>
          </div>
          <IdeFileTree
            project={project}
            onOpen={(path) => setProject((prev) => setActivePath(prev, path))}
            onCreateFile={(parent) => setPathDialog({ kind: 'file', parent })}
            onCreateFolder={(parent) =>
              setPathDialog({ kind: 'folder', parent })
            }
            onRename={(path) => setPathDialog({ kind: 'rename', path })}
            onDelete={(path) => {
              try {
                setProject((prev) => deletePath(prev, path))
                toast.message(`Deleted ${path}`)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Delete failed')
              }
            }}
          />
          <div className="flex flex-wrap gap-1 border-t border-border p-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-fog"
              onClick={() => setBackupOpen(true)}
            >
              <Download className="size-3" />
              Backup
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[11px] text-fog"
              onClick={() => setGithubOpen(true)}
            >
              <Github className="size-3" />
              GitHub
            </Button>
          </div>
        </aside>

        <div
          className="hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-mist/40 md:block"
          onMouseDown={onSidebarDrag}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />

        <section
          className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0"
          style={{ flex: `1 1 ${editorColumnPct}%`, minWidth: 0 }}
        >
          <div className="workspace-bar flex items-center gap-1 overflow-x-auto border-b border-border bg-carbon px-2">
            <Button
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => void runCompile()}
              disabled={compiling}
            >
              {compiling ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Compile
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setDeployOpen(true)}
              disabled={!compileResult?.ok}
            >
              <Rocket className="size-3.5" />
              Deploy
            </Button>

            <Select
              value={network}
              onValueChange={(v) => setNetwork(v as DeployNetwork)}
            >
              <SelectTrigger size="sm" className="h-8 min-w-[7.5rem] bg-void">
                <SelectValue placeholder="Network" />
              </SelectTrigger>
              <SelectContent>
                {DEPLOY_NETWORKS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {deployNetworkLabel(n).replace('Algorand ', '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mx-0.5 h-5 w-px bg-border" />

            <Button
              size="icon-sm"
              variant="ghost"
              className="text-fog"
              onClick={() => editorRef.current?.undo()}
              aria-label="Undo"
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-fog"
              onClick={() => editorRef.current?.redo()}
              aria-label="Redo"
            >
              <Redo2 className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-fog"
              onClick={saveSnapshot}
            >
              <Save className="size-3.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-fog"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-3.5" />
              <span className="hidden sm:inline">Versions</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-fog md:hidden"
              onClick={() => setBackupOpen(true)}
            >
              <FolderOpen className="size-3.5" />
            </Button>

            <div className="ml-auto flex items-center gap-2 text-[11px] text-fog">
              <span className="hidden font-mono text-[10px] sm:inline">
                {filename}
              </span>
              {compileResult ? (
                compileResult.ok ? (
                  <span className="text-pulse-green">Ready</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-coral-red">
                    <CircleAlert className="size-3" />
                    {problemCount} error{problemCount === 1 ? '' : 's'}
                  </span>
                )
              ) : (
                <span>Not compiled</span>
              )}
            </div>
          </div>

          <div className="flex items-center border-b border-border bg-void">
            <div className="flex h-8 items-center gap-1.5 border-r border-border bg-carbon px-3 text-[12px] text-paper">
              <FileCode2 className="size-3 text-signal-teal" />
              <span className="font-mono">{filename}</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <PuyaTsEditor
                key={filename}
                ref={editorRef}
                value={source}
                onChange={onSourceChange}
                filename={filename}
                diagnostics={compileResult?.diagnostics ?? []}
              />
            </div>

            <div
              className="h-1 shrink-0 cursor-row-resize bg-border transition-colors hover:bg-mist/40"
              onMouseDown={onTerminalDrag}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize terminal"
            />

            <div
              className="flex min-h-0 shrink-0 flex-col border-t border-border bg-void"
              style={{ height: layout.terminalH }}
            >
              <Tabs
                value={terminalTab}
                onValueChange={(v) => setTerminalTab(v as TerminalTab)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex items-center border-b border-border bg-carbon px-2">
                  <TabsList className="h-8 bg-transparent p-0">
                    <TabsTrigger
                      value="problems"
                      className="h-8 rounded-none border-b-2 border-transparent px-3 text-[12px] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    >
                      Problems
                      {problemCount + warningCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="ml-1.5 h-5 px-1.5 text-[10px]"
                        >
                          {problemCount + warningCount}
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger
                      value="artifacts"
                      className="h-8 rounded-none border-b-2 border-transparent px-3 text-[12px] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    >
                      Artifacts
                    </TabsTrigger>
                    <TabsTrigger
                      value="call"
                      className="h-8 rounded-none border-b-2 border-transparent px-3 text-[12px] data-[state=active]:border-primary data-[state=active]:bg-transparent"
                    >
                      Call
                    </TabsTrigger>
                  </TabsList>
                  <span className="ml-auto font-mono text-[10px] text-fog">
                    TERMINAL
                  </span>
                </div>

                <TabsContent
                  value="problems"
                  className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
                >
                  <ScrollArea className="h-full">
                    <div className="space-y-1 p-2 font-mono text-[12px]">
                      {!compileResult ||
                      compileResult.diagnostics.length === 0 ? (
                        <p className="px-2 py-1 text-fog">
                          No problems — compile the project to check for issues.
                        </p>
                      ) : (
                        compileResult.diagnostics.map((d, i) => (
                          <button
                            key={`${d.line}-${d.column}-${i}`}
                            type="button"
                            className={cn(
                              'flex w-full gap-2 rounded px-2 py-1 text-left hover:bg-carbon',
                              d.severity === 'error'
                                ? 'text-coral-red'
                                : 'text-bone',
                            )}
                            onClick={() => editorRef.current?.focus()}
                          >
                            <span className="shrink-0 text-fog">
                              [{d.severity}] L{d.line}:{d.column}
                            </span>
                            <span>{d.message}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent
                  value="artifacts"
                  className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
                >
                  <ScrollArea className="h-full">
                    <div className="space-y-3 p-3">
                      {!compileResult?.ok ? (
                        <EmptyState
                          compact
                          title="No artifacts yet"
                          description="Compile a valid Algorand TypeScript project to see approval / clear programs."
                        />
                      ) : (
                        <>
                          <div>
                            <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fog">
                              <Braces className="size-3" />
                              Contract
                              <span className="normal-case tracking-normal text-fog">
                                · {compileResult.mode}
                              </span>
                            </p>
                            <p className="font-mono text-sm text-paper">
                              {compileResult.contractName}
                            </p>
                            <ul className="mt-2 space-y-1 text-[12px] text-mist">
                              {compileResult.methods.map((m) => (
                                <li key={m.name} className="font-mono">
                                  {m.name}({m.params.join(', ')}):{' '}
                                  {m.returnType}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-fog">
                              Approval program
                              {compileResult.mode === 'structural'
                                ? ' (preview)'
                                : ''}
                            </p>
                            <pre className="overflow-x-auto rounded-md border border-border bg-carbon p-3 font-mono text-[11px] text-mist">
                              {compileResult.approvalTeal}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-fog">
                              Clear program
                            </p>
                            <pre className="overflow-x-auto rounded-md border border-border bg-carbon p-3 font-mono text-[11px] text-mist">
                              {compileResult.clearTeal}
                            </pre>
                          </div>
                          {compileResult.notes.map((n) => (
                            <p key={n} className="text-[12px] text-fog">
                              {n}
                            </p>
                          ))}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent
                  value="call"
                  className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
                >
                  <ScrollArea className="h-full">
                    <IdeMethodCallPanel
                      compileResult={compileResult}
                      network={network}
                      deployedAppId={deployedAppId}
                      onAppIdChange={setDeployedAppId}
                    />
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </section>

        <div
          className="hidden w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-mist/40 lg:block"
          onMouseDown={onChatDrag}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat"
        />

        <section
          className="flex h-[42vh] min-h-60 w-full flex-col lg:h-auto lg:min-w-70"
          style={{ flex: `1 1 ${layout.chatPct}%`, minWidth: 0 }}
        >
          <PuyaTsChatPanel
            model={model}
            project={project}
            setProject={setProject}
            compileProject={runCompile}
            lastCompile={() => compileRef.current}
            onRequestPay={requestPay}
            onBusyChange={setChatBusy}
            headerActions={
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <div className="min-w-0 max-w-[42vw] sm:max-w-none">
                  <ModelSwitcher
                    current={model}
                    models={chatModels}
                    busy={chatBusy}
                    onSelect={setModelSlug}
                  />
                </div>
                <div className="hidden items-center gap-1.5 rounded-md border border-border bg-void px-2.5 py-1.5 xl:flex">
                  <img src="/assets/usdc.png" alt="" className="size-3.5" />
                  <span className="text-[12px] font-medium text-paper">
                    {formatUsdc(model.priceUsdc)}
                  </span>
                </div>
                {account ? (
                  <div className="flex items-center gap-1">
                    <div className="hidden items-center gap-2 rounded-md border border-border bg-void px-2.5 py-1.5 sm:flex">
                      <img
                        src="/assets/algorand.png"
                        alt=""
                        className="size-4 rounded-sm"
                      />
                      <span className="font-mono text-[13px] tracking-tight text-mist">
                        {shortAddress}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2.5 text-fog"
                      onClick={() => disconnect()}
                    >
                      <LogOut className="size-4" />
                      <span className="hidden sm:inline">Log out</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-9 px-2.5 sm:px-3"
                    onClick={() => setConnectOpen(true)}
                  >
                    <Wallet className="size-4" />
                    <span className="hidden sm:inline">Connect</span>
                  </Button>
                )}
              </div>
            }
          />
        </section>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="w-[min(100%,360px)] border-border bg-carbon">
          <SheetHeader>
            <SheetTitle>Project versions</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100%-4rem)]">
            <div className="space-y-1 pr-2">
              {project.versions.length === 0 ? (
                <EmptyState
                  compact
                  title="No snapshots yet"
                  description="Save or compile to keep local version history."
                />
              ) : (
                project.versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="flex w-full flex-col rounded-md border border-border bg-void px-3 py-2 text-left hover:border-mist/30"
                    onClick={() => {
                      setProject((prev) => restoreProjectVersion(prev, v.id))
                      setHistoryOpen(false)
                      toast.message('Restored snapshot')
                    }}
                  >
                    <span className="text-[13px] text-paper">{v.label}</span>
                    <span className="mt-0.5 font-mono text-[10px] text-fog">
                      {v.activePath} · {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent className="border-border bg-carbon sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deploy application</DialogTitle>
            <DialogDescription className="text-fog">
              Deploys the compiled approval/clear programs to{' '}
              {deployNetworkLabel(network)} via your connected wallet
              {compileResult?.mode === 'structural'
                ? ' (preview compile — run a full compile before production use)'
                : ''}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-md border border-border bg-void p-3 text-[12px] text-mist">
            <p>
              Network:{' '}
              <span className="font-mono text-paper">
                {deployNetworkLabel(network)}
              </span>
            </p>
            <p>
              Contract:{' '}
              <span className="font-mono text-paper">
                {compileResult?.contractName ?? '—'}
              </span>
            </p>
            <p>
              Methods:{' '}
              <span className="font-mono">
                {compileResult?.methods.map((m) => m.name).join(', ') || '—'}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeployOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmDeploy()}
              disabled={deploying || !compileResult?.ok}
            >
              {deploying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              Sign & deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pathDialog)}
        onOpenChange={(o) => {
          if (!o) setPathDialog(null)
        }}
      >
        <DialogContent className="border-border bg-carbon sm:max-w-sm">
          {pathDialog ? (
            <IdePathPrompt
              title={
                pathDialog.kind === 'file'
                  ? 'New file path / name'
                  : pathDialog.kind === 'folder'
                    ? 'New folder path / name'
                    : `Rename ${pathDialog.path}`
              }
              defaultValue={
                pathDialog.kind === 'rename' ? pathDialog.path : ''
              }
              onSubmit={handlePathDialog}
              onCancel={() => setPathDialog(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent className="border-border bg-carbon sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Backup & load</DialogTitle>
            <DialogDescription className="text-fog">
              Download the project or load a folder / zip from your device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                void downloadProjectZip(project)
                toast.success('Downloading zip')
              }}
            >
              <Download className="size-4" />
              Download ZIP
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                downloadProjectJson(project)
                toast.success('Downloading JSON')
              }}
            >
              <Download className="size-4" />
              Download JSON
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                void saveProjectToDirectory(project)
                  .then(() => toast.success('Saved to folder'))
                  .catch((e) =>
                    toast.error(
                      e instanceof Error ? e.message : 'Folder save failed',
                    ),
                  )
              }}
            >
              <FolderOpen className="size-4" />
              Save to folder…
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                void loadProjectFromDirectory()
                  .then((p) => {
                    setProject(p)
                    setBackupOpen(false)
                    toast.success('Loaded folder')
                  })
                  .catch((e) =>
                    toast.error(
                      e instanceof Error ? e.message : 'Folder load failed',
                    ),
                  )
              }}
            >
              <Upload className="size-4" />
              Load folder…
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => folderInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Load folder (input fallback)
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => zipInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Upload ZIP / JSON
            </Button>
          </div>
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            onChange={(e) => {
              const list = e.target.files
              if (!list?.length) return
              void loadProjectFromFileListAsync(list).then((p) => {
                setProject(p)
                setBackupOpen(false)
                toast.success('Loaded folder')
              })
              e.target.value = ''
            }}
          />
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,.json,.micropay.json,application/zip,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void (async () => {
                try {
                  const p = file.name.endsWith('.json')
                    ? await loadProjectFromJson(file)
                    : await loadProjectFromZip(file)
                  setProject(p)
                  setBackupOpen(false)
                  toast.success('Project loaded')
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : 'Load failed',
                  )
                }
              })()
              e.target.value = ''
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={githubOpen} onOpenChange={setGithubOpen}>
        <DialogContent className="border-border bg-carbon sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>GitHub</DialogTitle>
            <DialogDescription className="text-fog whitespace-pre-wrap">
              {GITHUB_SETUP_NOTES}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-fog">
                Repo URL or owner/repo@branch
              </p>
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-fog">
                Personal access token (local only)
              </p>
              <Textarea
                value={githubPat}
                onChange={(e) => setGithubPat(e.target.value)}
                placeholder="Paste your GitHub token"
                className="min-h-20 font-mono text-sm"
              />
            </div>
            {project.github ? (
              <p className="font-mono text-[11px] text-mist">
                Linked: {project.github.owner}/{project.github.repo}@
                {project.github.branch}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              disabled={githubBusy || !githubUrl.trim()}
              onClick={() => void handleGithubImport()}
            >
              {githubBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Import
            </Button>
            <Button
              disabled={githubBusy}
              onClick={() => void handleGithubPush()}
            >
              {githubBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {model ? (
        <PayConfirmDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          model={model}
          confirming={confirming}
          onConfirm={() => {
            const action = pendingRef.current
            pendingRef.current = null
            if (!action) return
            runPaidAction(action)
          }}
        />
      ) : null}
    </div>
  )
}
