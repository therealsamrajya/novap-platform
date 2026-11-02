import { sql, type SQLWrapper } from "drizzle-orm";

// In LIKE, % and _ are wildcards. Escape them so a search for "50%" means the text "50%".
const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&");

// Case-insensitive (ASCII) "column contains term". Value is bound as a parameter, never inlined.
export const containsText = (column: SQLWrapper, term: string) =>
  sql`${column} LIKE ${`%${escapeLike(term)}%`} ESCAPE '\\'`;
