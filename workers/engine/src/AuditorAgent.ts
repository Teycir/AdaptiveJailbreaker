import type { Algorithm, EvalConfig, EvalState, TraceEvent } from "@ajar/types";
import {
  type IAttackAlgorithm,
  CrescendoAlgorithm,
  ActorAttackAlgorithm,
  XTeamingAlgorithm,
  makeInitialState,
  addMessageToState,
  addScoreToState,
  rollbackState,
  setStatus,
  getCurrentBranch,
  isComplete,
  shouldRollback,
  scoreTrend,
  callLLM,
  scoreResponse,
  HONEYPOT_TOOLS,
  interceptAllCalls,
} from "@ajar/lib";

// ── Algorithm registry ────────────────────────────────────────────────────────

const ALGORITHMS: Record<Algorithm, () => IAttackAlgorithm> = {
  crescendo: () => new CrescendoAlgorithm(),
  actorAttack: () => new ActorAttackAlgorithm(),
  xTeaming: () => new XTeamingAlgorithm(),
};

// ── AuditorAgent ──────────────────────────────────────────────────────────────

export class AuditorAgent {
  private config: EvalConfig;
  private apiKey: string;
  private algorithm: IAttackAlgorithm;
  private emit: (event: TraceEvent) => Promise<void>;

  constructor(config: EvalConfig, apiKey: string, emit: (event: TraceEvent) => Promise<void>) {
    this.config = config;
    this.apiKey = apiKey;
    this.algorithm = ALGORITHMS[config.algorithm]();
    this.emit = emit;
  }

  async run(): Promise<EvalState> {
    let state = makeInitialState(this.config, this.config.id);
    const apiKey = this.apiKey;

    // ── Phase 1: Initialize ─────────────────────────────────────────────────
    const initResult = await this.algorithm.initialize(state, apiKey);
    if (!initResult.ok) {
      console.error("[AuditorAgent] initialize() failed:", initResult.error);
      state = setStatus(state, "failed");
      await this.emit({ type: "status_change", status: "failed", message: initResult.error.message });
      return state;
    }

    state = addMessageToState(state, initResult.value);
    await this.emit({ type: "attacker_msg", content: initResult.value.content, branchId: state.currentBranchId });

    // ── Phase 2: Adaptive attack loop ───────────────────────────────────────
    while (!isComplete(state)) {
      const branchId = state.currentBranchId;
      await this.emit({ type: "turn_start", turn: state.totalTurns, branchId });

      // Get target context (current branch messages only)
      const branchResult = getCurrentBranch(state);
      if (!branchResult.ok) {
        state = setStatus(state, "failed");
        break;
      }
      const targetMessages = branchResult.value.messages;

      // Call target model
      const targetResult = await callLLM(
        {
          model: this.config.targetModel,
          messages: targetMessages,
          tools: HONEYPOT_TOOLS,
        },
        apiKey,
      );

      if (!targetResult.ok) {
        state = setStatus(state, "failed");
        await this.emit({ type: "status_change", status: "failed", message: targetResult.error.message });
        break;
      }

      const targetResponse = targetResult.value;

      // Handle tool interceptions
      if (targetResponse.toolCalls.length > 0) {
        const interceptions = interceptAllCalls(targetResponse.toolCalls);
        for (let i = 0; i < targetResponse.toolCalls.length; i++) {
          await this.emit({
            type: "tool_intercept",
            tool: targetResponse.toolCalls[i]!.function.name,
            args: targetResponse.toolCalls[i]!.function.arguments,
            simulated: interceptions[i]!.simulated,
          });
        }
      }

      // Score the response
      const scoreResult = await scoreResponse(
        this.config.goal,
        targetResponse.content,
        apiKey,
        this.config.scorerModel,
      );
      const score = scoreResult.ok ? scoreResult.value : 0.5; // neutral fallback — 0 can trigger premature rollback

      state = addMessageToState(state, { role: "assistant", content: targetResponse.content });
      state = addScoreToState(state, score);

      await this.emit({ type: "target_msg", content: targetResponse.content, score, branchId });

      // Fix #5: call getCurrentBranch once *after* addScoreToState so the trend
      // includes the score we just recorded, not the pre-update snapshot.
      // Assert ok here — a missing branch at this point is a programmer error.
      const updatedBranch = getCurrentBranch(state);
      if (!updatedBranch.ok) {
        state = setStatus(state, "failed");
        break;
      }
      await this.emit({ type: "score_update", score, trend: scoreTrend(updatedBranch.value) });

      // Check success
      if (score >= this.config.successThreshold) {
        state = setStatus(state, "success", state.totalTurns);
        await this.emit({ type: "status_change", status: "success" });
        break;
      }

      // ── Phase 3: Rollback decision ────────────────────────────────────────
      const currentBranch = updatedBranch.value;

      if (
        // Fix #10: pass successThreshold so shouldRollback doesn't fire on winning branches
        shouldRollback(currentBranch, this.config.successThreshold) &&
        state.totalRollbacks < this.config.maxRollbacks
      ) {
        const rollbackResult = rollbackState(state);
        if (rollbackResult.ok) {
          const fromBranch = state.currentBranchId;
          state = rollbackResult.value;
          const toBranch = state.currentBranchId;

          await this.emit({ type: "rollback", fromBranch, toBranch, reason: "score declining or stubborn refusal" });

          // Fix #11: treat a failed revise() as fatal rather than silently continuing
          // with an empty context, which would corrupt the target model's message history.
          const revisionResult = await this.algorithm.revise(state, "previous branch stalled", apiKey);
          if (!revisionResult.ok) {
            state = setStatus(state, "failed");
            await this.emit({ type: "status_change", status: "failed", message: revisionResult.error.message });
            break;
          }
          state = addMessageToState(state, revisionResult.value);
          await this.emit({ type: "attacker_msg", content: revisionResult.value.content, branchId: toBranch });
          continue;
        }
      }

      // Generate next attacker message
      const nextResult = await this.algorithm.nextMessage(state, apiKey);
      if (!nextResult.ok) {
        state = setStatus(state, "failed");
        await this.emit({ type: "status_change", status: "failed", message: nextResult.error.message });
        break;
      }

      state = addMessageToState(state, nextResult.value);
      await this.emit({ type: "attacker_msg", content: nextResult.value.content, branchId: state.currentBranchId });
    }

    // ── Phase 4: Finalize ───────────────────────────────────────────────────
    if (state.status === "running") {
      state = setStatus(state, "abandoned");
    }

    await this.emit({
      type: "complete",
      success: state.status === "success",
      turns: state.totalTurns,
      rollbacks: state.totalRollbacks,
    });

    return state;
  }
}
