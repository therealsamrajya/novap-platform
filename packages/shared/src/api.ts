import { z } from "zod";

// Response shapes shared by the API and the frontends.

// Every non-2xx API response has this shape (see CLAUDE.md "Error responses").
// Frontends only need to read `error`; `issues` is present on validation errors (400).
export type ApiError = {
  error: string;
  issues?: { path: PropertyKey[]; message: string }[];
};

// Every list endpoint returns this envelope.
export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

// Query params are strings, so numbers are coerced. Extend this for each list endpoint.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
