import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// Wraps the raw D1 binding in Drizzle. Call once per request: const db = getDb(c.env.DB)
export const getDb = (d1: D1Database) => drizzle(d1, { schema });

export type Db = ReturnType<typeof getDb>;
