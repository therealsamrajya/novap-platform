import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { emailVerificationTokens, users } from "../db/schema";
// Same random-token + sha256 scheme as session cookies and password resets.
import { hashSessionToken as hashToken, newSessionToken as newToken } from "../lib/session";

// Longer than a password reset: the link only confirms an address, it can't take over the account.
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// New verification token for the user. Older links stop working: only the newest email counts.
export async function createVerificationToken(db: Db, userId: number): Promise<string> {
  const token = newToken();
  await db.batch([
    db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId)),
    db.insert(emailVerificationTokens).values({
      id: await hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    }),
  ]);
  return token;
}

// Marks the email verified if the token is valid and not expired. Returns false otherwise.
export async function verifyEmail(db: Db, token: string): Promise<boolean> {
  // Deleting with RETURNING claims the token in one statement: a second click gets nothing.
  const [claimed] = await db
    .delete(emailVerificationTokens)
    .where(and(eq(emailVerificationTokens.id, await hashToken(token)), gt(emailVerificationTokens.expiresAt, new Date())))
    .returning({ userId: emailVerificationTokens.userId });
  if (!claimed) return false;

  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    // Keep the first verification time.
    .where(and(eq(users.id, claimed.userId), isNull(users.emailVerifiedAt)));
  return true;
}
