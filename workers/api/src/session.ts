import type { EvalState, TraceEvent } from "@ajar/types";
import type { Env } from "./types.ts";

export class SessionManager {
  constructor(private env: Env) {}

  async getState(sessionId: string): Promise<EvalState | null> {
    const data = await this.env.SESSIONS.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async setState(sessionId: string, state: EvalState): Promise<void> {
    await this.env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(state), {
      expirationTtl: 3600,
    });
  }

  async pushEvent(sessionId: string, event: TraceEvent): Promise<void> {
    const key = `events:${sessionId}`;
    const existing = await this.env.SESSIONS.get(key);
    const events = existing ? JSON.parse(existing) : [];
    events.push(event);
    await this.env.SESSIONS.put(key, JSON.stringify(events), {
      expirationTtl: 3600,
    });
  }

  async getEvents(sessionId: string): Promise<TraceEvent[]> {
    const data = await this.env.SESSIONS.get(`events:${sessionId}`);
    return data ? JSON.parse(data) : [];
  }
}
