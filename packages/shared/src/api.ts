import { z } from "zod";

// Response shapes shared by the API and the frontends. Zod schemas are the
// source of truth: the API builds its OpenAPI docs from them, types are inferred.

// Every non-2xx API response has this shape (see CLAUDE.md "Error responses").
// Frontends only need to read `error`; `issues` is present on validation errors (400).
export const apiErrorSchema = z.object({
  error: z.string().meta({ example: "Product not found" }),
  issues: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])).meta({ example: ["limit"] }),
        message: z.string().meta({ example: "Too big: expected number to be <=48" }),
        code: z.string().meta({ example: "too_big" }),
      }),
    )
    .optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// Every list endpoint returns this envelope.
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().meta({ example: 1 }),
    limit: z.number().int().meta({ example: 12 }),
    total: z.number().int().meta({ description: "Total matching items across all pages", example: 5 }),
  });
export type Paginated<T> = { items: T[]; page: number; limit: number; total: number };

// Query params are strings, so numbers are coerced. Extend this for each list endpoint.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});
