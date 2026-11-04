import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import type { ApiError, User } from "@novap/shared";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { adminTags } from "./lib/openapi";
import { SESSION_COOKIE } from "./lib/session";
import { loadSession, requireAdmin } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { requestLogger } from "./middleware/logger";
import { rateLimit } from "./middleware/rate-limit";
import { adminCategoriesRoute } from "./routes/admin/categories";
import { adminContactRoute } from "./routes/admin/contact";
import { adminImagesRoute } from "./routes/admin/images";
import { adminOrdersRoute } from "./routes/admin/orders";
import { adminProductsRoute } from "./routes/admin/products";
import { adminVariantsRoute } from "./routes/admin/variants";
import { accountRoute } from "./routes/account";
import { authRoute } from "./routes/auth";
import { categoriesRoute } from "./routes/categories";
import { checkoutRoute } from "./routes/checkout";
import { contactRoute } from "./routes/contact";
import { healthRoute } from "./routes/health";
import { imagesRoute } from "./routes/images";
import { productsRoute } from "./routes/products";
import { stripeRoute } from "./routes/stripe";
import { scheduled } from "./scheduled";

// `Env` is generated from wrangler.jsonc by `pnpm types` (worker-configuration.d.ts).
// Variables: per-request values set by middleware, read with c.get("user") / c.var.user.
export type AppEnv = { Bindings: Env; Variables: { user: User | null; requestId: string } };

const app = new OpenAPIHono<AppEnv>();

// First, so it times the whole request and every response (errors too) gets X-Request-Id.
app.use("*", requestLogger);

// The default Cross-Origin-Resource-Policy is same-origin, which stops the shop and admin
// (other origins) from showing product images in <img>. They are on the same site, so
// images get same-site; every other response keeps same-origin.
const defaultHeaders = secureHeaders();
const imageHeaders = secureHeaders({ crossOriginResourcePolicy: "same-site" });
app.use("*", (c, next) => (c.req.path.startsWith("/api/images/") ? imageHeaders : defaultHeaders)(c, next));

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

// Per-IP rate limits (middleware/rate-limit.ts) on endpoints worth abusing: password guessing,
// sign-up spam, emails sent to strangers, and checkouts that hold stock. After CORS, so
// preflight requests don't count. Paths are exact, so e.g. GET /api/checkout/sessions/... is free.
app.use("/api/auth/login", rateLimit("RATE_LIMIT", "login"));
app.use("/api/auth/register", rateLimit("RATE_LIMIT", "register"));
app.use("/api/checkout", rateLimit("RATE_LIMIT", "checkout"));
app.use("/api/auth/password/forgot", rateLimit("RATE_LIMIT_STRICT", "password-forgot"));
app.use("/api/auth/password/reset", rateLimit("RATE_LIMIT_STRICT", "password-reset"));
app.use("/api/auth/verify-email/resend", rateLimit("RATE_LIMIT_STRICT", "verify-resend"));
app.use("/api/contact", rateLimit("RATE_LIMIT_STRICT", "contact"));

// Sets c.var.user (or null) from the session cookie. Never rejects on its own.
app.use("/api/*", loadSession);

// Everything under /api/admin needs an admin: 401 not logged in, 403 not admin.
// Admin routers below rely on this guard instead of checking per route.
app.use("/api/admin/*", requireAdmin);

app.route("/api/health", healthRoute);
app.route("/api/auth", authRoute);
app.route("/api/account", accountRoute);
app.route("/api/categories", categoriesRoute);
app.route("/api/products", productsRoute);
app.route("/api/images", imagesRoute);
app.route("/api/contact", contactRoute);
app.route("/api/checkout", checkoutRoute);
app.route("/api/stripe", stripeRoute);

app.route("/api/admin/categories", adminCategoriesRoute);
app.route("/api/admin/products", adminProductsRoute);
app.route("/api/admin/variants", adminVariantsRoute);
app.route("/api/admin/images", adminImagesRoute);
app.route("/api/admin/orders", adminOrdersRoute);
app.route("/api/admin/contact", adminContactRoute);

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
    { name: "Auth", description: "Register, log in, log out, current user, password reset, email confirmation" },
    { name: "Account", description: "The logged-in customer's own data: order history" },
    { name: "Catalog", description: "Public products, categories and images" },
    { name: "Contact", description: "Public contact form" },
    { name: "Checkout", description: "Guest and customer checkout through Stripe" },
    // Admin sections need an admin session: 401 not logged in, 403 not an admin.
    { name: adminTags.categories, description: "Create, edit and delete categories. Admin only" },
    { name: adminTags.products, description: "All products, including inactive ones. Admin only" },
    { name: adminTags.variants, description: "Sizes / options of a product, with price and stock. Admin only" },
    { name: adminTags.images, description: "Upload product images to R2, reorder, delete. Admin only" },
    { name: adminTags.orders, description: "Orders from checkout: list, details, mark shipped with a tracking number. Admin only" },
    { name: adminTags.contact, description: "Messages from the contact form: read, archive, delete. Admin only" },
    { name: "System", description: "Health and diagnostics" },
  ],
});
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

app.notFound((c) => c.json({ error: "Not found" } satisfies ApiError, 404));
app.onError(errorHandler);

// fetch: HTTP requests (Hono). scheduled: the cron trigger in wrangler.jsonc.
export default { fetch: app.fetch, scheduled } satisfies ExportedHandler<Env>;
