/**
 * Map Router model ids / owned_by strings to provider logo assets.
 * Never surfaces 0G branding in the UI — those models use the Micropay glyph.
 */

export const PROVIDER_LOGO = {
  deepseek: "/assets/providers/deepseek.png",
  openai: "/assets/providers/openai.png",
  claude: "/assets/providers/claude.png",
  kimi: "/assets/providers/kimi.png",
  minimax: "/assets/providers/minimax.png",
  whisper: "/assets/providers/whisper.png",
  glm: "/assets/providers/glm.png",
  zAi: "/assets/providers/z-ai.png",
  hunyuan: "/assets/providers/hunyuan.png",
  zerog: "/assets/providers/zerog.png",
  qwen: "/assets/providers/qwen.png",
  micropay: "/assets/providers/micropay.svg",
} as const;

export type ProviderLogoKey = keyof typeof PROVIDER_LOGO;

export type ProviderBrand = {
  /** Stable key for filtering / logo lookup */
  key: ProviderLogoKey;
  /** User-facing family label (never "0G") */
  label: string;
  logoSrc: string;
};

const FALLBACK: ProviderBrand = {
  key: "micropay",
  label: "Micropay",
  logoSrc: PROVIDER_LOGO.micropay,
};

function isZeroGLabel(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v === "0g" ||
    v === "0g foundation" ||
    v === "zerog" ||
    v.includes("0g foundation") ||
    /^0g[\s_-]/.test(v)
  );
}

/**
 * Infer brand from model id / name / owned_by.
 * Prefer id prefixes; owned_by is usually "0G Foundation" and is ignored for logos.
 */
export function resolveProviderBrand(input: {
  id?: string | null;
  name?: string | null;
  ownedBy?: string | null;
}): ProviderBrand {
  const id = (input.id || "").toLowerCase();
  const name = (input.name || "").toLowerCase();
  const hay = `${id} ${name}`;

  // Whisper before generic openai / gpt checks
  if (hay.includes("whisper")) {
    return { key: "whisper", label: "OpenAI", logoSrc: PROVIDER_LOGO.whisper };
  }

  if (hay.includes("claude") || hay.includes("anthropic")) {
    return { key: "claude", label: "Anthropic", logoSrc: PROVIDER_LOGO.claude };
  }

  if (hay.includes("deepseek")) {
    return {
      key: "deepseek",
      label: "DeepSeek",
      logoSrc: PROVIDER_LOGO.deepseek,
    };
  }

  if (
    hay.includes("moonshot") ||
    hay.includes("kimi") ||
    /(^|[^a-z])k2(\.|-|$)/.test(hay)
  ) {
    return { key: "kimi", label: "Moonshot", logoSrc: PROVIDER_LOGO.kimi };
  }

  if (hay.includes("minimax")) {
    return { key: "minimax", label: "MiniMax", logoSrc: PROVIDER_LOGO.minimax };
  }

  // Z.ai image models prefer color mark; GLM chat models use black Z
  if (
    hay.includes("z-image") ||
    hay.includes("z.ai") ||
    /(^|[^a-z])zai([^a-z]|$)/.test(hay)
  ) {
    return { key: "zAi", label: "Z.ai", logoSrc: PROVIDER_LOGO.zAi };
  }

  if (hay.includes("glm") || hay.includes("zhipu") || hay.includes("zai-org")) {
    return { key: "glm", label: "Zhipu", logoSrc: PROVIDER_LOGO.glm };
  }

  if (
    hay.includes("hunyuan") ||
    hay.includes("tencent") ||
    id === "hy3" ||
    /^hy\d/.test(id)
  ) {
    return { key: "hunyuan", label: "Hunyuan", logoSrc: PROVIDER_LOGO.hunyuan };
  }

  if (
    hay.includes("openai") ||
    /(^|[^a-z])gpt[-_.]/.test(hay) ||
    /(^|[^a-z])o1([^a-z]|$)/.test(hay) ||
    /(^|[^a-z])o3([^a-z]|$)/.test(hay) ||
    /(^|[^a-z])o4([^a-z]|$)/.test(hay)
  ) {
    return { key: "openai", label: "OpenAI", logoSrc: PROVIDER_LOGO.openai };
  }

  if (hay.includes("qwen")) {
    return { key: "qwen", label: "Qwen", logoSrc: PROVIDER_LOGO.qwen };
  }

  // 0G-native / unknown → Micropay glyph (no public 0G mark)
  if (
    id.startsWith("0gm") ||
    hay.includes("0gm") ||
    (input.ownedBy && isZeroGLabel(input.ownedBy) && !matchesKnownFamily(hay))
  ) {
    return {
      key: "zerog",
      label: "Zero Gravity",
      logoSrc: PROVIDER_LOGO.zerog,
    };
  }

  if (input.ownedBy && !isZeroGLabel(input.ownedBy)) {
    const owned = input.ownedBy.trim();
    const ownedBrand = resolveProviderBrand({ id: owned, name: owned });
    if (ownedBrand.key !== "micropay") return ownedBrand;
    return {
      key: "micropay",
      label: owned,
      logoSrc: PROVIDER_LOGO.micropay,
    };
  }

  return FALLBACK;
}

function matchesKnownFamily(hay: string): boolean {
  return (
    hay.includes("claude") ||
    hay.includes("deepseek") ||
    hay.includes("kimi") ||
    hay.includes("moonshot") ||
    hay.includes("minimax") ||
    hay.includes("glm") ||
    hay.includes("zhipu") ||
    hay.includes("hunyuan") ||
    hay.includes("whisper") ||
    hay.includes("openai") ||
    hay.includes("qwen") ||
    /(^|[^a-z])gpt[-_.]/.test(hay) ||
    hay.includes("z-image")
  );
}

export function providerLogoSrc(input: {
  id?: string | null;
  name?: string | null;
  ownedBy?: string | null;
}): string {
  return resolveProviderBrand(input).logoSrc;
}

/** Strip 0G labels from any display string. */
export function sanitizeProviderLabel(
  label: string | null | undefined,
): string {
  if (!label || isZeroGLabel(label)) return "Micropay";
  return label;
}
