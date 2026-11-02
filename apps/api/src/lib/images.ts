// Public URL path for an R2 object, served by routes/images.ts.
// Keys may contain "/" (e.g. "products/1/main.webp"), so encode each segment separately.
export const imageUrl = (r2Key: string) =>
  `/api/images/${r2Key.split("/").map(encodeURIComponent).join("/")}`;
