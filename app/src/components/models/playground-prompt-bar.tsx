import { Grid2X2, Mic, Paperclip, Plus, Square, Workflow } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";

import type { ChatToolCapability } from "#/lib/tools-capabilities";

export function PlaygroundPromptBar({
  value,
  onChange,
  onRun,
  onStop,
  busy,
  capabilities,
  selectedTools,
  onSelectedToolsChange,
  onAttach,
  placeholder = "Start typing a prompt to see what our models can do",
  className,
  leading,
}: {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onStop?: () => void;
  busy?: boolean;
  capabilities: ChatToolCapability[];
  selectedTools: string[];
  onSelectedToolsChange: (next: string[]) => void;
  onAttach?: () => void;
  placeholder?: string;
  className?: string;
  leading?: ReactNode;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toolsId = useId();
  const canRun = Boolean(value.trim());
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcut = isMac ? "⌘ ↵" : "Ctrl ↵";

  useEffect(() => {
    if (!toolsOpen) return;
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsOpen]);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 md:px-6",
        className,
      )}
    >
      <div
        className="pointer-events-auto relative mx-auto w-full max-w-3xl"
        ref={panelRef}
      >
        {toolsOpen ? (
          <div
            id={toolsId}
            role="dialog"
            aria-label="Tools"
            className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-[min(100%,20rem)] overflow-hidden rounded-2xl border border-border bg-snow shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
          >
            {capabilities.length ? (
              <ul className="divide-y divide-border/80 py-1">
                {capabilities.map((tool) => (
                  <ToolRow
                    key={tool.name}
                    label={toolLabel(tool.name)}
                    description={tool.description}
                    checked={selectedTools.includes(tool.name)}
                    onChange={(checked) =>
                      onSelectedToolsChange(
                        checked
                          ? [...selectedTools, tool.name]
                          : selectedTools.filter((name) => name !== tool.name),
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                No server tools are currently available.
              </p>
            )}
            <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
              Selected tools run on Micropay and may make the response take
              longer.
            </p>
          </div>
        ) : null}

        <div className="rounded-[1.5rem] border border-border/80 bg-snow/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-md">
          <div className="flex items-end gap-1.5">
            <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
              {leading}
              <button
                type="button"
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors",
                  toolsOpen
                    ? "bg-obsidian text-ink"
                    : "text-mist hover:bg-obsidian hover:text-ink",
                )}
                aria-expanded={toolsOpen}
                aria-controls={toolsId}
                onClick={() => setToolsOpen((v) => !v)}
              >
                <Grid2X2 className="size-3.5" />
                Tools{selectedTools.length ? ` · ${selectedTools.length}` : ""}
              </button>
            </div>

            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={1}
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-base shadow-none focus-visible:ring-0"
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (!busy && canRun) onRun();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!busy && canRun) onRun();
                }
              }}
            />

            <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-full text-fog transition-colors hover:bg-obsidian hover:text-ink"
                aria-label="Attach"
                title="Attach files"
                disabled={busy}
                onClick={onAttach}
              >
                <Plus className="size-4" />
              </button>
              {busy ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-full px-3"
                  onClick={onStop}
                >
                  <Square className="size-3 fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-full px-3.5"
                  disabled={!canRun}
                  onClick={onRun}
                >
                  Run
                  <span className="hidden text-[10px] font-normal opacity-70 sm:inline">
                    {shortcut}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-ink">{label}</span>
        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-ink" : "bg-smoke",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-snow shadow transition-transform",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </button>
    </li>
  );
}

function toolLabel(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Compact attach affordance used when nesting under ChatPanel-like flows. */
export function PromptAttachHint() {
  return <Paperclip className="size-4" />;
}
