import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ModelSwitcher } from "#/components/models/model-switcher";
import {
  PlaygroundExplore,
  type ExploreMode,
} from "#/components/models/playground-explore";
import {
  DEFAULT_PLAYGROUND_TOOLS,
  PlaygroundPromptBar,
  type PlaygroundToolsState,
} from "#/components/models/playground-prompt-bar";
import {
  getSkipPayConfirm,
  PayConfirmDialog,
} from "#/components/pay-confirm-dialog";
import { Button } from "#/components/ui/button";
import { LoadingState } from "#/components/ui/loading-state";
import { type Model } from "#/data/models";
import {
  MODELS_CATALOG_STALE_MS,
  ensureModelsCatalog,
} from "#/lib/models-catalog-query";
import { useWallet } from "#/lib/wallet";

const ChatPanel = lazy(() =>
  import("#/components/models/chat-panel").then((m) => ({
    default: m.ChatPanel,
  })),
);

export const Route = createFileRoute("/_shell/")({
  loader: async ({ context: { queryClient } }) => {
    try {
      return await ensureModelsCatalog(queryClient);
    } catch (err) {
      console.error("[playground] route loader failed", err);
      return {
        models: [],
        source: "router" as const,
        error:
          err instanceof Error ? err.message : "Failed to load model catalog",
      };
    }
  },
  staleTime: MODELS_CATALOG_STALE_MS,
  preloadStaleTime: MODELS_CATALOG_STALE_MS,
  component: PlaygroundPage,
});

function pickDefaultChatModel(models: Model[]): Model | null {
  const chat = models.filter((m) => m.type === "Chat");
  if (chat.length === 0) return null;
  const recommended = chat.find((m) => m.recommended);
  if (recommended) return recommended;
  return [...chat].sort((a, b) => a.priceUsdc - b.priceUsdc)[0] ?? null;
}

function PlaygroundPage() {
  const catalog = Route.useLoaderData();
  const models = catalog?.models ?? [];
  const chatModels = useMemo(
    () => models.filter((m) => m.type === "Chat"),
    [models],
  );
  const { account, setConnectOpen, fetchWithPay } = useWallet();

  const [mode, setMode] = useState<ExploreMode>("models");
  const [input, setInput] = useState("");
  const [tools, setTools] = useState<PlaygroundToolsState>(
    DEFAULT_PLAYGROUND_TOOLS,
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [seedPrompt, setSeedPrompt] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pendingRef = useRef<null | (() => Promise<void>)>(null);

  const selectedModel = useMemo(() => {
    if (selectedSlug) {
      return chatModels.find((m) => m.slug === selectedSlug) ?? null;
    }
    return pickDefaultChatModel(chatModels);
  }, [chatModels, selectedSlug]);

  function runPaidAction(action: () => Promise<void>) {
    setPayOpen(false);
    setConfirming(true);
    void action()
      .catch(() => {
        /* toasts in panel */
      })
      .finally(() => {
        setConfirming(false);
      });
  }

  function requestPay(action: () => Promise<void>) {
    if (!account || !fetchWithPay) {
      setConnectOpen(true);
      toast.message("Connect a wallet to pay");
      return;
    }
    if (getSkipPayConfirm()) {
      runPaidAction(action);
      return;
    }
    pendingRef.current = action;
    setPayOpen(true);
  }

  function startChat(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (!selectedModel) {
      toast.error("No chat models available");
      return;
    }
    setSeedPrompt(trimmed);
    setInput("");
    setActive(true);
  }

  function resetToExplore() {
    setActive(false);
    setSeedPrompt(undefined);
    setInput("");
    setBusy(false);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-paper">
      <div className="flex h-10 shrink-0 items-center gap-2  px-3 md:px-4">
        {selectedModel && chatModels.length > 0 ? (
          <ModelSwitcher
            current={selectedModel}
            models={chatModels}
            busy={busy}
            onSelect={(slug) => {
              setSelectedSlug(slug);
              if (active) {
                setSeedPrompt(undefined);
              }
            }}
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {catalog.error
              ? "Couldn’t load models"
              : "No chat models available"}
          </p>
        )}
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs text-mist"
            onClick={resetToExplore}
          >
            Back to explore
          </Button>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {active && selectedModel ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <LoadingState compact label="Opening chat…" />
              </div>
            }
          >
            <ChatPanel
              key={`${selectedModel.slug}:${seedPrompt ?? "live"}`}
              model={selectedModel}
              onRequestPay={requestPay}
              onBusyChange={setBusy}
              initialPrompt={seedPrompt}
              freshSession
              hideSidebar
            />
          </Suspense>
        ) : (
          <>
            <div className="h-full overflow-y-auto">
              <PlaygroundExplore
                mode={mode}
                onModeChange={setMode}
                onPrompt={(p) => {
                  setInput(p);
                  startChat(p);
                }}
              />
            </div>
            <PlaygroundPromptBar
              value={input}
              onChange={setInput}
              onRun={() => startChat(input)}
              tools={tools}
              onToolsChange={setTools}
              onAttach={() =>
                toast.message("Attach files after you start a chat")
              }
            />
          </>
        )}
      </div>

      {selectedModel ? (
        <PayConfirmDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          model={selectedModel}
          confirming={confirming}
          onConfirm={() => {
            const action = pendingRef.current;
            pendingRef.current = null;
            if (action) runPaidAction(action);
          }}
        />
      ) : null}
    </div>
  );
}
