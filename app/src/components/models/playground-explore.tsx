import {
  Bot,
  Code2,
  ImageIcon,
  Mic,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

export type ExploreMode = "models" | "agents";

const MODEL_CARDS: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  href?: string;
  prompt?: string;
}[] = [
  {
    id: "featured",
    title: "Featured",
    description: "Try recommended chat models with wallet micropayments.",
    icon: Sparkles,
    accent: "bg-amber-100 text-amber-700",
    href: "/models",
  },
  {
    id: "chat",
    title: "Code and Chat",
    description: "Stream replies from frontier LLMs. Pay only when you run.",
    icon: Code2,
    accent: "bg-sky-100 text-sky-700",
    prompt: "Explain how micropayments work for AI APIs in two sentences.",
    href: "https://code.micropay.website",
  },
  {
    id: "image",
    title: "Image Generation",
    description: "Browse image models and generate from a prompt.",
    icon: ImageIcon,
    accent: "bg-violet-100 text-violet-700",
    href: "/models?type=image",
  },
  {
    id: "audio",
    title: "Speech and Audio",
    description: "Transcribe and process audio with pay-per-use models.",
    icon: Mic,
    accent: "bg-rose-100 text-rose-700",
    href: "/models?type=audio",
  },
  {
    id: "activities",
    title: "Activities",
    description: "View your past micropayments and transactions.",
    icon: Zap,
    accent: "bg-orange-100 text-orange-700",
    href: "/activities",
  },
  {
    id: "tools",
    title: "Tools & grounding",
    description:
      "Toggle structured outputs, search, and function calling in Tools.",
    icon: Bot,
    accent: "bg-emerald-100 text-emerald-700",
    prompt: "List three ways agents can call paid MicroPay endpoints.",
    href: "/api-reference",
  },
];

const AGENT_CARDS: {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  href: string;
}[] = [
  {
    id: "mcp",
    title: "MCP server",
    description:
      "Connect agents to MicroPay tools over the Model Context Protocol.",
    icon: Bot,
    accent: "bg-sky-100 text-sky-700",
    href: "/agents",
  },
  {
    id: "ide",
    title: "Algorand IDE",
    description:
      "Compile and deploy Puya TypeScript contracts in the code product.",
    icon: Code2,
    accent: "bg-emerald-100 text-emerald-700",
    href: "/agents",
  },
  {
    id: "api",
    title: "HTTP APIs",
    description: "Chat, images, and audio endpoints with x402 micropayments.",
    icon: Zap,
    accent: "bg-amber-100 text-amber-700",
    href: "/api-reference",
  },
];

export function PlaygroundExplore({
  mode,
  onModeChange,
  onPrompt,
}: {
  mode: ExploreMode;
  onModeChange: (mode: ExploreMode) => void;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 pb-40 pt-8 sm:px-6 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight text-ink sm:text-3xl">
          {mode === "models" ? "Explore models" : "Explore agents"}
        </h2>
        <div
          className="inline-flex rounded-full border border-border bg-snow p-0.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
          role="tablist"
          aria-label="Explore mode"
        >
          {(["models", "agents"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => onModeChange(m)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[12px] capitalize transition-colors",
                mode === m ? "bg-ink text-snow" : "text-mist hover:text-ink",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "models" ? (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODEL_CARDS.map((card) => {
              const Icon = card.icon;
              const inner = (
                <>
                  <span
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-lg",
                      card.accent,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <p className="mt-3 text-[15px] font-medium tracking-tight text-ink">
                    {card.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                    {card.description}
                  </p>
                </>
              );

              if (card.prompt) {
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onPrompt(card.prompt!)}
                    className="surface-card rounded-2xl border border-border p-4 text-left transition-colors hover:border-smoke hover:bg-snow"
                  >
                    {inner}
                  </button>
                );
              }

              return card.href && card.href.startsWith("http") ? (
                <a
                  key={card.id}
                  href={card.href}
                  className="surface-card block rounded-2xl border border-border p-4 no-underline transition-colors hover:border-smoke hover:bg-snow"
                >
                  {inner}
                </a>
              ) : (
                <Link
                  key={card.id}
                  to={card.href ?? "/models"}
                  className="surface-card block rounded-2xl border border-border p-4 no-underline transition-colors hover:border-smoke hover:bg-snow"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
          <div className="mt-6">
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link to="/models">Start building</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.id}
                to={card.href as "/agents" | "/api-reference"}
                className="surface-card block rounded-2xl border border-border p-4 no-underline transition-colors hover:border-smoke hover:bg-snow"
              >
                <span
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-lg",
                    card.accent,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <p className="mt-3 text-[15px] font-medium tracking-tight text-ink">
                  {card.title}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                  {card.description}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
