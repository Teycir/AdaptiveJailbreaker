// ── Algorithms ────────────────────────────────────────────────────────────────

export type Algorithm = "crescendo" | "actorAttack" | "xTeaming";

// ── LLM ──────────────────────────────────────────────────────────────────────

export type Role = "user" | "assistant" | "system";

export type Message = {
  role: Role;
  content: string;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

export type LLMRequest = {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  /** When true, passes format:"json" to Ollama so the model is forced to emit a JSON body */
  jsonMode?: boolean;
};

export type LLMResponse = {
  content: string;
  toolCalls: ToolCall[];
  promptTokens: number;
  completionTokens: number;
};

// ── Eval config ───────────────────────────────────────────────────────────────

export type EvalConfig = {
  id: string;
  algorithm: Algorithm;
  targetModel: string;
  attackerModel: string;
  scorerModel: string;
  goal: string;
  maxTurns: number;
  maxRollbacks: number;
  successThreshold: number; // 0–1, default 0.85
};

// ── State ─────────────────────────────────────────────────────────────────────

export type Branch = {
  id: number;
  parentId: number | null;
  messages: Message[];
  scores: number[]; // one per target turn on this branch
  rolledBack: boolean;
};

export type EvalStatus = "running" | "success" | "failed" | "abandoned";

export type EvalState = {
  runId: string;
  config: EvalConfig;
  branches: Branch[];
  currentBranchId: number;
  totalTurns: number;
  totalRollbacks: number;
  status: EvalStatus;
  successTurn: number | null;
};

// ── Trace events (streamed to browser over WebSocket) ────────────────────────

export type TraceEvent =
  | { type: "turn_start"; turn: number; branchId: number }
  | { type: "attacker_msg"; content: string; branchId: number }
  | { type: "target_msg"; content: string; score: number; branchId: number }
  | { type: "tool_intercept"; tool: string; args: unknown; simulated: boolean }
  | { type: "rollback"; fromBranch: number; toBranch: number; reason: string }
  | { type: "score_update"; score: number; trend: number[] }
  | { type: "status_change"; status: EvalStatus; message?: string }
  | { type: "complete"; success: boolean; turns: number; rollbacks: number }
  // Sent once to late-joining WebSocket clients so they can reconstruct current state.
  | { type: "snapshot"; state: EvalState };

// ── Honeypot ──────────────────────────────────────────────────────────────────

export type ToolPolicy = "allow" | "simulate" | "block";

export type InterceptResult = {
  policy: ToolPolicy;
  simulated: boolean;
  result: unknown;
};
