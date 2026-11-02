import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { ApiError } from "@novap/shared";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { errorHandler } from "./middleware/error";
import { categoriesRoute } from "./routes/categories";
import { healthRoute } from "./routes/health";
import { imagesRoute } from "./routes/images";
import { productsRoute } from "./routes/products";

// `Env` is generated from wrangler.jsonc by `pnpm types` (worker-configuration.d.ts).
export type AppEnv = { Bindings: Env };

const app = new OpenAPIHono<AppEnv>();

app.use("*", secureHeaders());

// Shop and admin run on different origins, so the browser needs CORS.
// credentials: true lets the session cookie travel with requests.
app.use("/api/*", (c, next) =>
  cors({
    origin: [c.env.SHOP_URL, c.env.ADMIN_URL],
    credentials: true,
  })(c, next),
);

app.route("/api/health", healthRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api/products", productsRoute);
app.route("/api/images", imagesRoute);

// ---------------------------------------------------------------- API docs
// The OpenAPI spec is generated from the zod schemas used for validation, so it
// can't drift from the code. Swagger UI: http://localhost:8787/api/docs
// Hidden in production so admin routes (phase 5) aren't advertised.
const docsOutsideProduction: MiddlewareHandler<AppEnv> = async (c, next) => {
  // APP_ENV is typed from wrangler.jsonc ("development"); production sets it per environment.
  if ((c.env.APP_ENV as string) === "production") throw new HTTPException(404, { message: "Not found" });
  await next();
};
app.use("/api/openapi.json", docsOutsideProduction);
app.use("/api/docs", docsOutsideProduction);

app.doc31("/api/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "NŌVAP API",
    version: "0.1.0",
    description:
      "Money is integer cents (AUD, GST-inclusive). Every error response is `{ error, issues? }`; " +
      "`issues` only on 400. Lists return `{ items, page, limit, total }`.",
  },
  tags: [
    { name: "Catalog", description: "Public products, categories and images" },
    { name: "System", description: "Health and diagnostics" },
  ],
});
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

app.notFound((c) => c.json({ error: "Not found" } satisfies ApiError, 404));
app.onError(errorHandler);

export default app;
