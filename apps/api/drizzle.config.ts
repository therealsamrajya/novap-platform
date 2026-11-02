import { defineConfig } from "drizzle-kit";

// drizzle-kit reads schema.ts and writes SQL migration files.
// wrangler then applies those files to D1 (see db:migrate scripts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
});
