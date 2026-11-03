import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../index";

type Limiter = "RATE_LIMIT" | "RATE_LIMIT_STRICT";

// Limits requests per client IP with a rate limit binding from wrangler.jsonc.
// `scope` keeps each endpoint's counter separate, so logging in a few times doesn't use up
// the contact form's allowance. Over the limit: 429 with Retry-After (both bindings use 60s).
//
// The limiter counts per Cloudflare location and is eventually consistent, so it slows down
// scripted abuse (password guessing, email spam) rather than enforcing an exact number.
export const rateLimit =
  (limiter: Limiter, scope: string): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    // Set by Cloudflare on every request; locally (wrangler dev) all requests share one key.
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    const { success } = await c.env[limiter].limit({ key: `${scope}:${ip}` });
    if (!success) {
      throw new HTTPException(429, {
        message: "Too many requests. Please wait a minute and try again.",
        // The error handler copies these headers onto the JSON response.
        res: new Response(null, { headers: { "Retry-After": "60" } }),
      });
    }
    await next();
  };
