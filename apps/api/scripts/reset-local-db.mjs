// Deletes the local D1 database so db:reset:local can migrate + seed a fresh one.
//   pnpm --filter @novap/api db:reset:local
//
// All or nothing: the folder is renamed first, then deleted. On Windows a running
// `wrangler dev` keeps the SQLite files open; deleting in place would remove some
// files and then fail, leaving a broken half-database. A rename of a folder with
// open files fails as a whole, so the data stays intact and we can just stop.
import { existsSync, renameSync, rmSync } from "node:fs";

const dir = ".wrangler/state/v3/d1";

if (!existsSync(dir)) process.exit(0); // nothing to delete yet (first run)

const trash = `${dir}.deleting-${Date.now()}`;
try {
  renameSync(dir, trash);
} catch (err) {
  if (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES") {
    console.error(
      "\nThe local database is in use, probably by a running `pnpm dev:api`.\n" +
        "Stop it (Ctrl+C in its terminal), then run the reset again. Nothing was deleted.\n",
    );
    process.exit(1);
  }
  throw err;
}
rmSync(trash, { recursive: true, force: true });
