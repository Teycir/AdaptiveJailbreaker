// packages/lib/src/llm/local.ts
// Local model detection and OpenAI-compatible proxy

export type LocalProvider = "ollama" | "lmstudio" | null;

export interface LocalConfig {
  provider: LocalProvider;
  baseUrl: string;
  model: string;
}

const OLLAMA_URL = "http://localhost:11434";
const LMSTUDIO_URL = "http://localhost:1234";

/**
 * List all models available from Ollama.
 */
export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return data.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}

/**
 * Detect available local model provider.
 * If modelOverride is provided (e.g. "llama3:8b"), that model is used directly
 * instead of auto-picking the first available one.
 */
export async function detectLocalProvider(modelOverride?: string): Promise<LocalConfig | null> {
  // Try Ollama
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        models?: Array<{ name: string; details?: { families?: string[] } }>;
      };
      const allModels = data.models ?? [];

      // Filter out embedding models and cloud-relay stubs for auto-selection
      const chatModels = allModels.filter((m) => {
        const families = m.details?.families?.map((f) => f.toLowerCase()) ?? [];
        const isEmbed = families.some((f) => /bert|embed/.test(f));
        const isCloud = m.name.endsWith(":cloud");
        return !isEmbed && !isCloud;
      });

      if (modelOverride) {
        // Caller supplied a specific model — honour it regardless of filters
        const exists = allModels.some((m) => m.name === modelOverride);
        if (exists) return { provider: "ollama", baseUrl: `${OLLAMA_URL}/v1`, model: modelOverride };
      }

      const model = chatModels[0]?.name;
      if (model) return { provider: "ollama", baseUrl: `${OLLAMA_URL}/v1`, model };
    }
  } catch {
    // Ollama not available
  }

  // Try LM Studio
  try {
    const res = await fetch(`${LMSTUDIO_URL}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = data.data?.map((m) => m.id) ?? [];
      const model = modelOverride && models.includes(modelOverride)
        ? modelOverride
        : models[0];
      if (model) {
        return { provider: "lmstudio", baseUrl: `${LMSTUDIO_URL}/v1`, model };
      }
    }
  } catch {
    // LM Studio not available
  }

  return null;
}

/**
 * Check if a model name is a local model reference.
 * Matches "ollama", "local", or "local/<anything>".
 */
export function isLocalModel(model: string): boolean {
  return model === "ollama" || model.startsWith("local/") || model === "local";
}

/**
 * Extract the specific model name from a local model reference.
 * "ollama" → undefined (auto-detect)
 * "local/llama3:8b" → "llama3:8b"
 * "local" → undefined (auto-detect)
 */
export function extractLocalModelName(model: string): string | undefined {
  if (model.startsWith("local/")) return model.slice("local/".length);
  return undefined;
}

/**
 * Get local model config, caching by model string.
 */
const configCache = new Map<string, LocalConfig | null>();

export async function getLocalConfig(modelRef?: string): Promise<LocalConfig | null> {
  const key = modelRef ?? "__auto__";
  if (configCache.has(key)) return configCache.get(key)!;
  const override = modelRef ? extractLocalModelName(modelRef) : undefined;
  const config = await detectLocalProvider(override);
  configCache.set(key, config);
  return config;
}
