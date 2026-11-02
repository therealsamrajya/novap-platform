import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { ApiError } from "@novap/shared";
import { errorHandler } from "./middleware/error";
import { categoriesRoute } from "./routes/categories";
import { health } from "./routes/health";
import { imagesRoute } from "./routes/images";
import { productsRoute } from "./routes/products";

// `Env` is generated from wrangler.jsonc by `pnpm types` (worker-configuration.d.ts).
export type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

// Shop and admin run on different origins, so the browser needs CORS.
// credentials: true lets the session cookie travel with requests.
app.use("/api/*", (c, next) =>
  cors({
    origin: [c.env.SHOP_URL, c.env.ADMIN_URL],
    credentials: true,
  })(c, next),
);

app.route("/api/health", health);
app.route("/api/categories", categoriesRoute);
app.route("/api/products", productsRoute);
app.route("/api/images", imagesRoute);

app.notFound((c) => c.json({ error: "Not found" } satisfies ApiError, 404));
app.onError(errorHandler);

export default app;
