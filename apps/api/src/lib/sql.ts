import { sql, type SQLWrapper } from "drizzle-orm";

// In LIKE, % and _ are wildcards. Escape them so a search for "50%" means the text "50%".
const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&");

// Case-insensitive (ASCII) "column contains term". Value is bound as a parameter, never inlined.
export const containsText = (column: SQLWrapper, term: string) =>
  sql`${column} LIKE ${`%${escapeLike(term)}%`} ESCAPE '\\'`;

// True if a write failed on a UNIQUE column (e.g. a duplicate slug or SKU).
// D1 puts the reason in the error message; Drizzle wraps that error, so check the causes too.
export function isUniqueViolation(err: unknown): boolean {
  for (let e = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("UNIQUE constraint failed")) return true;
  }
  return false;
}
