import type { z } from "zod";
import { ApiRequestError } from "./api";

export type FieldErrors = Record<string, string>;

type Issue = { path: PropertyKey[]; message: string };

// First message per top-level field, e.g. { priceCents: "Too small" }.
// Issues without a path (refines on the whole object) go under "form".
export function toFieldErrors(issues: readonly Issue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length ? String(issue.path[0]) : "form";
    out[key] ??= issue.message;
  }
  return out;
}

// Validate with the same shared schema the API uses, so most mistakes show before a request.
export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.output<S>; errors: null } | { data: null; errors: FieldErrors } {
  const result = schema.safeParse(values);
  return result.success ? { data: result.data, errors: null } : { data: null, errors: toFieldErrors(result.error.issues) };
}

// Server errors: field issues for a 400, otherwise the message under "form".
export function errorsFrom(err: unknown): FieldErrors {
  if (err instanceof ApiRequestError) {
    return err.issues.length ? toFieldErrors(err.issues) : { form: err.message };
  }
  return { form: "Something went wrong" };
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");
