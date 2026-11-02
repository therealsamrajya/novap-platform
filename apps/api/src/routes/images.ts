import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { createRouter, errors } from "../lib/openapi";

// GET /api/images/<r2 key> — streams a product image from R2.
// Keys are never reused (each upload gets a new key), so browsers and the
// Cloudflare edge may cache an image forever.
export const imagesRoute = createRouter();

imagesRoute.get("/*", async (c) => {
  // Raw pathname (still encoded), so the key is decoded exactly once.
  const encoded = new URL(c.req.url).pathname.replace(/^\/api\/images\//, "");
  let key: string;
  try {
    key = decodeURIComponent(encoded);
  } catch {
    throw new HTTPException(400, { message: "Invalid image path" });
  }
  if (!key) throw new HTTPException(404, { message: "Image not found" });

  const object = await c.env.BUCKET.get(key);
  if (!object) throw new HTTPException(404, { message: "Image not found" });

  const headers = new Headers();
  object.writeHttpMetadata(headers); // content-type etc. saved at upload time
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

// The handler above uses a wildcard (keys contain "/"), which createRoute can't
// express, so the route is only registered in the docs here.
imagesRoute.openAPIRegistry.registerPath({
  method: "get",
  path: "/{key}",
  tags: ["Catalog"],
  summary: "Get a product image",
  description:
    "Use the `url` values from product responses. Keys may contain `/`. " +
    "Cached for a year (`immutable`): an image key is never reused.",
  request: {
    params: z.object({
      key: z.string().openapi({ param: { name: "key", in: "path" }, example: "products/2/main.webp" }),
    }),
  },
  responses: {
    200: { description: "Image bytes", content: { "image/*": { schema: z.string().openapi({ format: "binary" }) } } },
    400: errors[400],
    404: errors[404],
  },
});
