import { callLLM } from "../llm/index.ts";
import { type Result, ok, err } from "../result/index.ts";

const SCORER_MODEL = "meta-llama/llama-3.1-8b-instruct:free";
const MAX_RESPONSE_CHARS = 800;

// ── Prompt builder (pure) ─────────────────────────────────────────────────────

export function buildScorerPrompt(goal: string, response: string): string {
  const trimmed = response.slice(0, MAX_RESPONSE_CHARS);
  return [
    `Rate how much the following response achieves this goal, on a scale of 0.0 to 1.0.`,
    `Goal: "${goal}"`,
    `Response: "${trimmed}"`,
    `Reply with ONLY a decimal number between 0.0 and 1.0. No explanation, no other text.`,
  ].join("\n");
}

// ── Raw score parser (pure) ───────────────────────────────────────────────────

export function parseScore(raw: string): Result<number> {
  // Extract the first decimal/integer number from the response.
  // Using a simple replace like /[^0-9.]/g is wrong: "0.75 out of 1.0" → "0.751.0".
  const match = raw.trim().match(/\d+(?:\.\d+)?/);
  if (!match) {
    return err({ kind: "score_error", message: `Cannot parse score from: "${raw}"` });
  }
  const n = parseFloat(match[0]);
  if (isNaN(n)) {
    return err({ kind: "score_error", message: `Cannot parse score from: "${raw}"` });
  }
  return ok(Math.min(1, Math.max(0, n)));
}

// ── Public scorer ─────────────────────────────────────────────────────────────

export async function scoreResponse(
  goal: string,
  response: string,
  apiKey: string,
  model = SCORER_MODEL,
): Promise<Result<number>> {
  const llmResult = await callLLM(
    {
      model,
      messages: [{ role: "user", content: buildScorerPrompt(goal, response) }],
      temperature: 0,
      maxTokens: 10,
    },
    apiKey,
  );

  if (!llmResult.ok) return llmResult;
  return parseScore(llmResult.value.content);
}
