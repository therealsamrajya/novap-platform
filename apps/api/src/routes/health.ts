import { createRoute, z } from "@hono/zod-openapi";
import { createRouter, json } from "../lib/openapi";

const Health = z
  .object({
    status: z.literal("ok"),
    env: z.string().openapi({ example: "development" }),
    db: z.boolean().openapi({ description: "D1 answered" }),
    storage: z.boolean().openapi({ description: "R2 answered" }),
    time: z.string().openapi({ example: "2026-11-02T00:00:00.000Z" }),
  })
  .openapi("Health");

// GET /api/health — confirms the Worker runs and can reach D1 and R2.
const health = createRoute({
  method: "get",
  path: "/",
  tags: ["System"],
  summary: "Health check",
  responses: { 200: json(Health, "Worker, D1 and R2 status") },
});

export const healthRoute = createRouter().openapi(health, async (c) => {
  const db = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  const bucket = await c.env.BUCKET.list({ limit: 1 });

  return c.json(
    {
      status: "ok" as const,
      env: c.env.APP_ENV,
      db: db?.ok === 1,
      storage: Array.isArray(bucket.objects),
      time: new Date().toISOString(),
    },
    200,
  );
});
