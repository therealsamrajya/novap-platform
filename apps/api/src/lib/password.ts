// Password hashing with PBKDF2-SHA256 from WebCrypto, which Workers have built in
// (bcrypt/argon2 would need WASM). 100k iterations is the Workers maximum.
// Stored as "pbkdf2$<iterations>$<salt b64>$<hash b64>" so the cost can be raised
// later: old hashes still verify because they carry their own iteration count.
// scripts/hash-password.mjs produces the same format with Node, for seeding.

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, HASH_BYTES * 8);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterations, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !hash) return false;
  const expected = fromBase64(hash);
  const actual = await derive(password, fromBase64(salt), Number(iterations));
  // Constant-time compare, so response timing doesn't reveal how many bytes matched.
  return actual.length === expected.length && crypto.subtle.timingSafeEqual(actual, expected);
}

// A valid hash of a random password. Login checks unknown emails against it so
// "no such user" takes as long as "wrong password" and timing can't reveal which emails exist.
export const DUMMY_PASSWORD_HASH = "pbkdf2$100000$c2FsdHNhbHRzYWx0c2FsdA==$I9iBZhDn7PjWqglJIi6wUB65v1v/7hQX/0VqhXohrIY=";
