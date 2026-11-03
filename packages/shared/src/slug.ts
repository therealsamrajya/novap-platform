// URL slugs: lowercase letters, numbers and single hyphens ("reference-02").
// The API uses slugify() when an admin leaves the slug out; the admin form can
// use the same function to prefill the slug field while the name is typed.

export const SLUG_MAX = 100;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// "Café Noir — 10 mg" -> "cafe-noir-10-mg". Returns "" when nothing usable is
// left (e.g. a name written only in a non-Latin script); callers must handle that.
export function slugify(text: string): string {
  return text
    .normalize("NFKD") // split "é" into "e" + accent mark...
    .replace(/[̀-ͯ]/g, "") // ...and drop the accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/^-+|-+$/g, "");
}
