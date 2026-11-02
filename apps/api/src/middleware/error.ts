import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

// One place that turns thrown errors into JSON responses.
// Routes can just `throw new HTTPException(403, { message: "..." })`.
export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof ZodError) {
    return c.json({ error: "Invalid input", issues: err.issues }, 400);
  }
  // Unknown error: log details server-side, never leak them to the client.
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
};
