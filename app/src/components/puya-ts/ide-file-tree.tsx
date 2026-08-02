import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import {
  buildTreeRows,
  type IdeFileNode,
  type IdeProjectState,
} from '#/lib/puya-ts-project'
import { cn } from '#/lib/utils'

export function IdeFileTree({
  project,
  onOpen,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: {
  project: IdeProjectState
  onOpen: (path: string) => void
  onCreateFile: (parentDir: string) => void
  onCreateFolder: (parentDir: string) => void
  onRename: (path: string) => void
  onDelete: (path: string) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    for (const f of project.files) {
      if (f.kind === 'folder') s.add(f.path)
      const parts = f.path.split('/')
      for (let i = 1; i < parts.length; i++) {
        s.add(parts.slice(0, i).join('/'))
      }
    }
    return s
  })

  const rows = useMemo(
    () => buildTreeRows(project.files, expanded),
    [project.files, expanded],
  )

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-2 pb-1">
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-fog"
          title="New file"
          onClick={() => onCreateFile('')}
        >
          <FilePlus className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-fog"
          title="New folder"
          onClick={() => onCreateFolder('')}
        >
          <FolderPlus className="size-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {rows.map((row) => {
          const isActive =
            row.kind === 'file' && row.path === project.activePath
          return (
            <div
              key={row.path}
              className={cn(
                'group flex w-full items-center gap-0.5 rounded-md text-[12px]',
                isActive ? 'bg-obsidian text-ink' : 'text-mist hover:bg-obsidian/60',
              )}
              style={{ paddingLeft: 4 + row.depth * 12 }}
            >
              {row.kind === 'folder' ? (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1 text-left"
                  onClick={() => toggle(row.path)}
                >
                  {expanded.has(row.path) ? (
                    <ChevronDown className="size-3 shrink-0 text-fog" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-fog" />
                  )}
                  <Folder className="size-3.5 shrink-0 text-bone" />
                  <span className="truncate">{row.name}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-left"
                  onClick={() => onOpen(row.path)}
                >
                  <span className="w-3 shrink-0" />
                  <FileCode2 className="size-3.5 shrink-0 text-signal-teal" />
                  <span className="truncate font-mono">{row.name}</span>
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-6 opacity-0 group-hover:opacity-100"
                    aria-label="File actions"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {row.kind === 'folder' ? (
                    <>
                      <DropdownMenuItem onClick={() => onCreateFile(row.path)}>
                        <FilePlus className="size-3.5" />
                        New file
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onCreateFolder(row.path)}>
                        <FolderPlus className="size-3.5" />
                        New folder
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={() => onRename(row.path)}>
                    <Pencil className="size-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-coral-red"
                    onClick={() => onDelete(row.path)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function IdePathPrompt({
  title,
  defaultValue,
  onSubmit,
  onCancel,
}: {
  title: string
  defaultValue?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(defaultValue || '')
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">{title}</p>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value.trim())
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSubmit(value.trim())} disabled={!value.trim()}>
          OK
        </Button>
      </div>
    </div>
  )
}

export function fileCountLabel(files: IdeFileNode[]) {
  const n = files.filter((f) => f.kind === 'file').length
  return `${n} file${n === 1 ? '' : 's'}`
}
