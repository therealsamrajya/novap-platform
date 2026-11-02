import { OpenAPIHono, z } from "@hono/zod-openapi";
import { apiErrorSchema } from "@novap/shared";
import type { AppEnv } from "../index";

// Every route file uses this instead of `new Hono()`. Routes declared with
// createRoute are validated AND appear in the OpenAPI docs (/api/docs).
// The hook rethrows validation errors so middleware/error.ts formats them
// like every other error: { error, issues }.
export const createRouter = () =>
  new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) throw result.error;
    },
  });

// Named schemas show up once under "Schemas" in Swagger instead of being repeated inline.
const ApiError = apiErrorSchema.openapi("ApiError");

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export const errors = {
  400: json(ApiError, "Invalid input. `issues` lists each problem"),
  404: json(ApiError, "Not found"),
  500: json(ApiError, "Internal server error"),
} as const;

export const slugParams = (example: string) =>
  z.object({
    slug: z
      .string()
      .min(1)
      .max(200)
      .openapi({ param: { name: "slug", in: "path" }, example }),
  });
