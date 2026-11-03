import { z } from "zod";

// Message only for a missing field; every other problem keeps its own message.
// (A plain `{ error: "..." }` on the schema would also replace the max-length message.)
export const required = (message: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? message : undefined),
});

// ---------------------------------------------------------------- query params

// "?inStock=true" -> true. z.coerce.boolean() would turn "false" into true.
export const booleanParam = z.enum(["true", "false"]).transform((v) => v === "true");

// Empty strings ("?q=") are treated as "not set" so forms can send blank fields.
export const optionalText = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v || undefined)
  .optional();
