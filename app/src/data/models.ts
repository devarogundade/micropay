export type ModelType = "Chat" | "Image Gen" | "Audio";

/** Absolute floor for catalog display and x402 charges (USDC). */
export const MIN_PAY_USDC = 0.05;

/** Cap for per-use catalog / x402 amounts (USDC). */
export const MAX_PAY_USDC = 0.2;

export type Model = {
  slug: string;
  name: string;
  provider: string;
  type: ModelType;
  /** Display price in USDC for micropay / x402 (estimated from Router USD rates). */
  priceUsdc: number;
  description: string;
  trending?: boolean;
  recommended?: boolean;
  /** Glyph shown when a provider logo asset is unavailable. */
  icon: string;
  /** Public path to provider logo under /assets/providers/. */
  logoSrc: string;
  accent: string;
  /** Canonical provider model id (same as slug when live). */
  routerId?: string;
  teeAttested?: boolean;
  providerCount?: number;
  contextLength?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  verifiability?: string;
  /** Router API formats for this model (e.g. openai, anthropic). */
  supportedFormats?: string[];
};

/**
 * Per-model prices in the 0.05-0.2 USDC band.
 */
export function modelMinPayUsdc(
  input: { id: string; name?: string; ownedBy?: string },
  type: ModelType,
): number {
  const hay =
    `${input.id} ${input.name ?? ""} ${input.ownedBy ?? ""}`.toLowerCase();

  const isSmall =
    /(^|[^a-z])(mini|nano|tiny|lite|small|flash)([^a-z]|$)/.test(hay) ||
    /(^|[^a-z])([1-4])b([^a-z]|$)/.test(hay) ||
    hay.includes("whisper") ||
    hay.includes("tts");

  const isFrontier =
    /gpt-4|gpt-5|gpt-oss-120|o1|o3|o4|opus|405b|\br1\b/.test(hay) ||
    /claude-3-5|claude-3\.5|claude-4|sonnet-4/.test(hay);

  const isGptFamily =
    /(^|[^a-z])gpt([-_.]|$)/.test(hay) ||
    hay.includes("openai") ||
    /(^|[^a-z])o[1-4]([^a-z]|$)/.test(hay);

  const isStrong =
    isFrontier ||
    (!isSmall &&
      (isGptFamily ||
        /claude|deepseek|kimi|moonshot|qwen|gemini|llama-3|70b|72b|32b|120b/.test(
          hay,
        )));

  if (type === "Image Gen") {
    if (isSmall) return 0.05;
    if (isFrontier || isGptFamily) return 0.2;
    return 0.1;
  }
  if (type === "Audio") {
    return isSmall ? 0.05 : 0.1;
  }

  if (isSmall) return 0.05;
  if (isFrontier) return 0.2;
  if (isStrong) return 0.15;
  if (/(7b|8b|9b|13b|14b)/.test(hay)) return 0.1;
  return 0.1;
}

/** True when a model should rank first in the IDE picker (OpenAI / GPT family). */
export function isIdeGptPreferredModel(
  m: Pick<Model, "slug" | "name" | "provider">,
): boolean {
  const hay = `${m.slug} ${m.name} ${m.provider}`.toLowerCase();
  return (
    m.provider === "OpenAI" ||
    /(^|[^a-z])gpt([-_.]|$)/.test(hay) ||
    /(^|[^a-z])o[1-4]([^a-z]|$)/.test(hay)
  );
}

/** IDE-only: GPT / OpenAI models first; relative order otherwise preserved. */
export function sortModelsGptFirst(models: Model[]): Model[] {
  return [...models].sort((a, b) => {
    const ag = isIdeGptPreferredModel(a) ? 0 : 1;
    const bg = isIdeGptPreferredModel(b) ? 0 : 1;
    return ag - bg;
  });
}

export function formatUsdc(amount: number): string {
  if (amount < 0.0001) return `${amount.toFixed(6)} USDC`;
  if (amount < 0.01) return `${amount.toFixed(4)} USDC`;
  if (amount < 1) {
    // Prefer "0.02 USDC" over "0.020 USDC" for micropay display amounts.
    const trimmed = amount.toFixed(3).replace(/\.?0+$/, "");
    return `${trimmed} USDC`;
  }
  return `${amount.toFixed(3)} USDC`;
}
