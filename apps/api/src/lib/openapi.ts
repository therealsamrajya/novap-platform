import { OpenAPIHono, z } from "@hono/zod-openapi";
import { apiErrorSchema, idParamSchema } from "@novap/shared";
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
  401: json(ApiError, "Not logged in, or the session expired"),
  403: json(ApiError, "Logged in, but not allowed (e.g. not an admin)"),
  404: json(ApiError, "Not found"),
  409: json(ApiError, "Conflicts with existing data"),
  413: json(ApiError, "Request body too large"),
  415: json(ApiError, "Body must be sent with Content-Type: application/json"),
  500: json(ApiError, "Internal server error"),
} as const;

// Add `security: cookieAuth` to routes that need a login. Shows a lock icon in Swagger.
// The scheme itself is registered in index.ts.
export const cookieAuth = [{ cookieAuth: [] }];

export const slugParams = (example: string) =>
  z.object({
    slug: z
      .string()
      .min(1)
      .max(200)
      .openapi({ param: { name: "slug", in: "path" }, example }),
  });

export const idParams = (example: number) =>
  z.object({ id: idParamSchema.openapi({ param: { name: "id", in: "path" }, example }) });

// Swagger UI has no nested tags, so admin sections share a prefix and sit together.
// Listed (with descriptions) in index.ts; the order there is the order in Swagger.
export const adminTags = {
  categories: "Admin · Categories",
  products: "Admin · Products",
  variants: "Admin · Variants",
  images: "Admin · Images",
  contact: "Admin · Contact inbox",
} as const;
