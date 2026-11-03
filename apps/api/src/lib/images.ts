import type { ImageType } from "@novap/shared";

// Public URL path for an R2 object, served by routes/images.ts.
// Keys may contain "/" (e.g. "products/1/main.webp"), so encode each segment separately.
export const imageUrl = (r2Key: string) =>
  `/api/images/${r2Key.split("/").map(encodeURIComponent).join("/")}`;

// The browser's Content-Type is just a claim, so the real type is read from the
// file's first bytes ("magic numbers"). Returns null for anything else.
export function sniffImageType(head: Uint8Array): { type: ImageType; ext: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return { type: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  // ISO media file: "ftyp" box, then the brand. avis = animated AVIF.
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return { type: "image/avif", ext: "avif" };
  return null;
}
