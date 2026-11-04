import type { ApiError } from "@novap/shared";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { AppEnv } from "../index";

// One place that turns thrown errors into JSON responses.
// Routes can just `throw new HTTPException(403, { message: "..." })`.
// Every error body matches ApiError so frontends only ever read `error`.
// Used when an HTTPException has no message, e.g. the 403 thrown by Hono's csrf().
const fallbackMessages: Record<number, string> = {
  400: "Bad request",
  401: "Not logged in",
  403: "Forbidden",
  404: "Not found",
  413: "Request body too large",
  415: "Unsupported content type",
  429: "Too many requests",
};

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HTTPException) {
    const error = err.message || fallbackMessages[err.status] || "Request failed";
    // An HTTPException can carry headers in `res` (e.g. Retry-After on a 429); keep them.
    err.res?.headers.forEach((value, name) => {
      if (name !== "content-type") c.header(name, value);
    });
    return c.json({ error } satisfies ApiError, err.status);
  }
  if (err instanceof ZodError) {
    // Only path/message/code are sent, so the issue shape is stable and documented.
    const issues = err.issues.map(({ path, message, code }) => ({
      path: path.filter((p): p is string | number => typeof p !== "symbol"),
      message,
      code,
    }));
    return c.json({ error: "Invalid input", issues } satisfies ApiError, 400);
  }
  // Unknown error: log details server-side with the request id, never leak them to the client.
  console.error({
    msg: "unhandled error",
    requestId: c.var.requestId,
    method: c.req.method,
    path: c.req.path,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return c.json({ error: "Internal server error" } satisfies ApiError, 500);
};
