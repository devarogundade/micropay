import { Paperclip, Plus, Square } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import { ChatToolsSelector } from "#/components/models/chat-tools-selector";

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
  const canRun = Boolean(value.trim());
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcut = isMac ? "⌘ ↵" : "Ctrl ↵";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 md:px-6",
        className,
      )}
    >
      <div
        className="pointer-events-auto relative mx-auto w-full max-w-3xl"
      >
        <div className="rounded-[1.5rem] border border-border/80 bg-snow/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-md">
          <div className="flex items-end gap-1.5">
            <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
              {leading}
              <ChatToolsSelector
                capabilities={capabilities}
                selectedTools={selectedTools}
                onSelectedToolsChange={onSelectedToolsChange}
                disabled={busy}
              />
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

/** Compact attach affordance used when nesting under ChatPanel-like flows. */
export function PromptAttachHint() {
  return <Paperclip className="size-4" />;
}
