import type { UserRole } from "@novap/shared";

export const SESSION_COOKIE = "novap_session";

// Admin sessions are short because an admin cookie can change the whole shop.
// Both are sliding: an active user is renewed, an idle one expires.
const HOUR_MS = 60 * 60 * 1000;
export const sessionTtlMs = (role: UserRole) => (role === "admin" ? 12 * HOUR_MS : 30 * 24 * HOUR_MS);

// 32 random bytes = 256 bits, unguessable. base64url so it is cookie-safe.
export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The DB stores sha256(token), never the token itself (see sessions in db/schema.ts).
export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
