/**
 * Result<T, E> — explicit error handling without bare catch blocks.
 * Every fallible function returns Result instead of throwing.
 * Callers are forced to handle both cases.
 */

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = AppError> = Ok<T> | Err<E>;

// ── Constructors ──────────────────────────────────────────────────────────────

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ── Typed application errors ──────────────────────────────────────────────────

export type AppError =
  | { kind: "llm_error"; message: string; status?: number }
  | { kind: "parse_error"; message: string; raw: string }
  | { kind: "score_error"; message: string }
  | { kind: "state_error"; message: string }
  | { kind: "config_error"; message: string }
  | { kind: "network_error"; message: string; cause?: unknown }
  | { kind: "unknown_error"; message: string; cause?: unknown };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Unwrap or throw — only use at boundaries where you want to escalate */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new Error(`[${result.error.kind}] ${result.error.message}`);
}

/** Map the Ok value, pass Err through unchanged */
export function mapOk<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (result.ok) return ok(fn(result.value));
  return result;
}

/** Wrap an async function that may throw into a Result */
export async function tryAsync<T>(
  fn: () => Promise<T>,
  toError: (cause: unknown) => AppError,
): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(toError(cause));
  }
}
