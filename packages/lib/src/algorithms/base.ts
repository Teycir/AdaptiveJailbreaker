import type { EvalState, Message } from "@ajar/types";
import type { Result } from "../result/index.ts";

/**
 * Strip markdown JSON fences that some local models (e.g. gemma4) wrap around
 * their output even when instructed to return raw JSON.
 * Handles:  ```json\n{...}\n```  and  ```\n{...}\n```
 */
export function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/**
 * IAttackAlgorithm — every algorithm implements this interface.
 * The AuditorAgent calls these methods and never needs to know
 * which algorithm is running.
 */
export interface IAttackAlgorithm {
  readonly name: string;

  /** Return the opening attacker message to start the conversation */
  initialize(state: EvalState, apiKey: string): Promise<Result<Message>>;

  /** Given current state, produce the next attacker message */
  nextMessage(state: EvalState, apiKey: string): Promise<Result<Message>>;

  /**
   * After a rollback, produce a fresh opening that takes a different angle.
   * `reason` explains why the previous branch was abandoned.
   */
  revise(state: EvalState, reason: string, apiKey: string): Promise<Result<Message>>;
}
