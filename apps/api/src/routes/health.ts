import { Hono } from "hono";
import type { AppEnv } from "../index";

// GET /api/health — confirms the Worker runs and can reach D1 and R2.
export const health = new Hono<AppEnv>().get("/", async (c) => {
  const db = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  const bucket = await c.env.BUCKET.list({ limit: 1 });

  return c.json({
    status: "ok",
    env: c.env.APP_ENV,
    db: db?.ok === 1,
    storage: Array.isArray(bucket.objects),
    time: new Date().toISOString(),
  });
});
