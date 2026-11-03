import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { ApiError, User } from "@novap/shared";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { SESSION_COOKIE } from "./lib/session";
import { loadSession, requireAdmin } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { adminCategoriesRoute } from "./routes/admin/categories";
import { adminProductsRoute } from "./routes/admin/products";
import { adminVariantsRoute } from "./routes/admin/variants";
import { authRoute } from "./routes/auth";
import { categoriesRoute } from "./routes/categories";
import { contactRoute } from "./routes/contact";
import { healthRoute } from "./routes/health";
import { imagesRoute } from "./routes/images";
import { productsRoute } from "./routes/products";

// `Env` is generated from wrangler.jsonc by `pnpm types` (worker-configuration.d.ts).
// Variables: per-request values set by middleware, read with c.get("user") / c.var.user.
export type AppEnv = { Bindings: Env; Variables: { user: User | null } };

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

// CORS alone doesn't stop a plain HTML form on another site from POSTing here.
// csrf() rejects form-style requests whose Origin isn't the shop or admin.
// (JSON requests from other origins are already blocked by the CORS preflight.)
app.use("/api/*", (c, next) => csrf({ origin: [c.env.SHOP_URL, c.env.ADMIN_URL] })(c, next));

// Sets c.var.user (or null) from the session cookie. Never rejects on its own.
app.use("/api/*", loadSession);

// Everything under /api/admin needs an admin: 401 not logged in, 403 not admin.
// Admin routers below rely on this guard instead of checking per route.
app.use("/api/admin/*", requireAdmin);

app.route("/api/health", healthRoute);
app.route("/api/auth", authRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api/products", productsRoute);
app.route("/api/images", imagesRoute);
app.route("/api/contact", contactRoute);

app.route("/api/admin/categories", adminCategoriesRoute);
app.route("/api/admin/products", adminProductsRoute);
app.route("/api/admin/variants", adminVariantsRoute);

// ---------------------------------------------------------------- API docs
// The OpenAPI spec is generated from the zod schemas used for validation, so it
// can't drift from the code. Swagger UI: http://localhost:8787/api/docs
// Hidden in production so admin routes aren't advertised.
const docsOutsideProduction: MiddlewareHandler<AppEnv> = async (c, next) => {
  // APP_ENV is typed from wrangler.jsonc ("development"); production sets it per environment.
  if ((c.env.APP_ENV as string) === "production") throw new HTTPException(404, { message: "Not found" });
  await next();
};
app.use("/api/openapi.json", docsOutsideProduction);
app.use("/api/docs", docsOutsideProduction);

app.openAPIRegistry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: SESSION_COOKIE,
  description: "Session cookie set by POST /api/auth/login. Browsers send it automatically.",
});
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
    { name: "Admin", description: "Catalogue management. Needs an admin session (401 / 403 otherwise)" },
    { name: "Auth", description: "Register, log in, log out, current user" },
    { name: "Catalog", description: "Public products, categories and images" },
    { name: "Contact", description: "Public contact form" },
    { name: "System", description: "Health and diagnostics" },
  ],
});
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

app.notFound((c) => c.json({ error: "Not found" } satisfies ApiError, 404));
app.onError(errorHandler);

export default app;
