import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";

// One log line per request, plus an X-Request-Id header on every response.
// When a user reports an error, the id in the response (or the browser's network tab)
// finds the matching log line, including the 500's details from middleware/error.ts.
//
// In production the line is a JSON object: Workers Logs (observability in wrangler.jsonc)
// indexes its fields, so logs can be filtered by status, path or userId. Locally it's one
// short readable line instead.
export const requestLogger: MiddlewareHandler<AppEnv> = async (c, next) => {
  // cf-ray is Cloudflare's own id for the request, also shown on Cloudflare error pages.
  // Locally there is none, so make one. Never taken from the client, so it can't be spoofed.
  const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  const start = Date.now();

  await next();

  c.header("X-Request-Id", requestId);
  const ms = Date.now() - start;
  const { method } = c.req;
  const path = c.req.path;
  const status = c.res.status;

  if (c.env.APP_ENV === "development") {
    console.log(`${method} ${path} ${status} ${ms}ms`);
    return;
  }
  // Only ids and metadata: no bodies, query strings, cookies or emails end up in logs.
  const entry = { msg: "request", requestId, method, path, status, ms, userId: c.var.user?.id ?? null };
  if (status >= 500) console.error(entry);
  else console.log(entry);
};
