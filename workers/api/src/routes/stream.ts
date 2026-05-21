// GET /evals/:id/ws — proxy WebSocket upgrade to the Durable Object

import { Hono } from "hono";
import type { Env } from "../types.ts";

export const streamRouter = new Hono<{ Bindings: Env }>();

streamRouter.get("/:id/ws", async (c) => {
  const evalId = c.req.param("id");
  const doId = c.env.EVAL_SESSION.idFromName(evalId);
  const stub = c.env.EVAL_SESSION.get(doId);

  // Forward the raw request (including the Upgrade header) to the DO
  return stub.fetch(c.req.raw);
});
