// GET /evals/:id/stream — SSE stream of eval events

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env } from "../types.ts";

export const streamRouter = new Hono<{ Bindings: Env }>();

streamRouter.get("/:id/stream", async (c) => {
  const evalId = c.req.param("id");
  
  return streamSSE(c, async (stream) => {
    let lastEventCount = 0;
    
    // Poll KV for new events every 500ms
    const interval = setInterval(async () => {
      try {
        const eventsData = await c.env.SESSIONS.get(`events:${evalId}`);
        if (!eventsData) return;
        
        const stored: { ts: number; event: unknown }[] = JSON.parse(eventsData);
        const newEvents = stored.slice(lastEventCount);
        
        for (const entry of newEvents) {
          await stream.writeSSE({
            data: JSON.stringify(entry),
          });
        }
        
        lastEventCount = stored.length;
      } catch (err) {
        console.error("SSE error:", err);
      }
    }, 500);
    
    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(interval);
    });
  });
});
