import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../index";

// GET /api/images/<r2 key> — streams a product image from R2.
// Keys are never reused (each upload gets a new key), so browsers and the
// Cloudflare edge may cache an image forever.
export const imagesRoute = new Hono<AppEnv>().get("/*", async (c) => {
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
