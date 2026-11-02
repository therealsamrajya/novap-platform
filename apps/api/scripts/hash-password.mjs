// Prints a password hash in the same format as src/lib/password.ts.
// Used for seed.sql, or to set a password directly in D1.
//   node apps/api/scripts/hash-password.mjs "the password"
import { pbkdf2Sync, randomBytes } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}
const iterations = 100_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256");
console.log(`pbkdf2$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`);
