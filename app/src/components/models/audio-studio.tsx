import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Loader2, Mic, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { formatBytes } from "#/components/models/chat-types";
import { EmptyState } from "#/components/ui/empty-state";
import { ErrorState } from "#/components/ui/error-state";
import { LoadingState } from "#/components/ui/loading-state";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { formatUsdc, type Model } from "#/data/models";
import {
  fetchTranscriptionHistory,
  proxyAudioTranscription,
  type TranscriptionHistoryItem,
} from "#/lib/micropay-api";
import { invalidateUsageQueries } from "#/lib/query-invalidation";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "#/lib/storage-limits";
import { cn } from "#/lib/utils";
import { useWallet } from "#/lib/wallet";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
] as const;

function WaveformBars({ active }: { active: boolean }) {
  const bars = useMemo(
    () => Array.from({ length: 28 }, (_, i) => 20 + ((i * 37) % 70)),
    [],
  );
  return (
    <div className="flex h-12 items-end justify-center gap-0.5" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-sm bg-mist/25 transition-all",
            active && "bg-primary/70 animate-pulse",
          )}
          style={{
            height: `${h}%`,
            animationDelay: active ? `${i * 40}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function AudioStudio({
  model,
  onRequestPay,
  onBusyChange,
}: {
  model: Model;
  onRequestPay: (action: () => Promise<void>) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { account, fetchWithPay } = useWallet();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState("auto");
  const [result, setResult] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [history, setHistory] = useState<TranscriptionHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [busy, setBusyState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function setBusy(next: boolean) {
    setBusyState(next);
    onBusyChange?.(next);
  }

  useEffect(() => {
    return () => onBusyChange?.(false);
  }, [onBusyChange]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function loadHistory() {
    if (!account || !fetchWithPay) {
      setHistory([]);
      setHistoryError(null);
      return;
    }
    setLoadingHistory(true);
    setHistoryError(null);
    void fetchTranscriptionHistory({ fetchImpl: fetchWithPay })
      .then((res) => {
        if (!res.ok) {
          setHistoryError(res.error || "Could not load history");
          setHistory([]);
          return;
        }
        setHistory(res.data);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }

  useEffect(() => {
    if (!account || !fetchWithPay) {
      setHistory([]);
      setHistoryError(null);
      return;
    }

    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError(null);
    void fetchTranscriptionHistory({ fetchImpl: fetchWithPay })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setHistoryError(res.error || "Could not load history");
          setHistory([]);
          return;
        }
        setHistory(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account, fetchWithPay]);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (
      !f.type.startsWith("audio/") &&
      !/\.(mp3|wav|m4a|webm|ogg|flac)$/i.test(f.name)
    ) {
      toast.error("Please choose an audio file");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `Audio must be under ${MAX_UPLOAD_LABEL} (${formatBytes(f.size)} given)`,
      );
      return;
    }
    setFile(f);
    setResult(null);
    setActiveId(null);
    setError(null);
  }

  function openHistoryItem(item: TranscriptionHistoryItem) {
    setActiveId(item.id);
    setResult(item.text);
    setError(null);
  }

  function transcribe() {
    if (!file || busy) return;
    setError(null);

    onRequestPay(async () => {
      setBusy(true);
      try {
        const res = await proxyAudioTranscription({
          model: model.routerId ?? model.slug,
          file,
          filename: file.name,
          language: language === "auto" ? undefined : language,
          fetchImpl: fetchWithPay,
        });
        if (!res.ok) {
          setError(res.error || "Transcription failed");
          toast.error(res.error || "Transcription failed");
          return;
        }
        setResult(res.text);
        void invalidateUsageQueries(queryClient, account?.address);

        if (fetchWithPay) {
          const hist = await fetchTranscriptionHistory({
            fetchImpl: fetchWithPay,
          });
          if (hist.ok) {
            setHistory(hist.data);
            setHistoryError(null);
            const newest = hist.data[0];
            if (newest) setActiveId(newest.id);
          } else {
            setHistoryError(hist.error || "History refresh failed");
          }
        }

        toast.success("Transcription complete");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    });
  }

  function exportTxt() {
    if (!result) return;
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fromHistory = history.find((h) => h.id === activeId);
    const base =
      fromHistory?.filename?.replace(/\.[^.]+$/, "") ||
      file?.name?.replace(/\.[^.]+$/, "") ||
      "audio";
    a.download = `transcript-${base}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[minmax(280px,340px)_1fr]">
      <aside className="flex min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center px-4 lg:h-[var(--app-header-height)]">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-fog">
              Studio
            </p>
            <h2 className="text-sm font-medium leading-none text-ink">
              Audio transcription
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-8 transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/60",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Upload className="size-7 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-ink">Drop audio here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                mp3, wav, m4a, webm, ogg · max {MAX_UPLOAD_LABEL}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
              disabled={busy}
            />
          </div>

          {file ? (
            <div className="rounded-xl border border-border bg-paper p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
              <WaveformBars active={busy} />
              <p className="mt-3 truncate text-xs text-mist">{file.name}</p>
              <p className="mt-0.5 text-[11px] text-fog">
                {formatBytes(file.size)}
              </p>
              {previewUrl ? (
                <audio
                  key={previewUrl}
                  controls
                  preload="metadata"
                  src={previewUrl}
                  className="mt-3 h-10 w-full accent-ink"
                  aria-label={`Preview ${file.name}`}
                >
                  Your browser does not support audio playback.
                </audio>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Language (optional)</Label>
            <Select
              value={language}
              onValueChange={setLanguage}
              disabled={busy}
            >
              <SelectTrigger className="w-full bg-paper" aria-label="Language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            disabled={busy || !file}
            onClick={transcribe}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mic className="size-4" />
            )}
            {busy
              ? "Transcribing…"
              : `Transcribe · ${formatUsdc(model.priceUsdc)}`}
          </Button>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Upload a clip, pay with your wallet, and get a written transcript.
              Past runs stay in History.
            </p>
          )}

          <div className="border-t border-border/70 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                History
              </p>
              {history.length > 0 ? (
                <span className="text-[10px] text-fog">{history.length}</span>
              ) : null}
            </div>

            {!account ? (
              <EmptyState
                compact
                title="Connect a wallet"
                description="Connect a wallet to save and browse past transcripts."
              />
            ) : loadingHistory ? (
              <LoadingState compact label="Loading history…" />
            ) : historyError && history.length === 0 ? (
              <ErrorState
                compact
                description={historyError}
                onRetry={loadHistory}
              />
            ) : history.length === 0 ? (
              <EmptyState
                compact
                title="No transcripts yet"
                description="No transcripts yet. Transcribe a clip — it will show up here."
              />
            ) : (
              <ScrollArea className="h-[min(36vh,240px)]">
                <ul className="space-y-1 pr-2">
                  {history.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openHistoryItem(item)}
                        className={cn(
                          "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                          activeId === item.id
                            ? "border-mist/30 bg-obsidian"
                            : "border-transparent hover:border-border hover:bg-paper/80",
                        )}
                      >
                        <p className="truncate text-[12px] text-mist">
                          {item.filename || "Transcript"}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-fog">
                          {item.text}
                        </p>
                        <p className="mt-1 text-[10px] text-fog/80">
                          {relativeTime(item.createdAt)}
                          {item.fileSize != null
                            ? ` · ${formatBytes(item.fileSize)}`
                            : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 flex-col bg-paper">
        <div className="flex h-10 shrink-0 items-center justify-between px-4 lg:h-[var(--app-header-height)]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground"></p>
          {result ? (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(result);
                  toast.success("Copied transcript");
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={exportTxt}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {busy ? (
            <LoadingState className="h-full" label="Transcribing…" />
          ) : result ? (
            <p className="mx-auto max-w-2xl text-sm leading-relaxed whitespace-pre-wrap text-mist">
              {result}
            </p>
          ) : (
            <EmptyState
              className="h-full"
              icon={Mic}
              title={
                account
                  ? "Your transcript will show up here"
                  : "Connect a wallet to start"
              }
              description={
                account
                  ? "Drop an audio file and pay once to get a written transcript."
                  : "Connect, upload a clip, and past runs stay in History."
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
