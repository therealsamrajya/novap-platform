import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { passwordResetTokens, sessions, users } from "../db/schema";
import { hashPassword } from "../lib/password";
// Same random-token + sha256 scheme as session cookies.
import { hashSessionToken as hashToken, newSessionToken as newToken } from "../lib/session";

// Short, because whoever holds the link can take over the account.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Creates a reset token for the account with this email. Returns null for an unknown
// email; the route answers the same either way, so nobody learns which emails exist.
// Any older unused link for the account stops working: only the newest email counts.
export async function createPasswordResetToken(
  db: Db,
  email: string,
): Promise<{ token: string; name: string; email: string } | null> {
  const user = await db.query.users.findFirst({ columns: { id: true, name: true, email: true }, where: eq(users.email, email) });
  if (!user) return null;

  const token = newToken();
  await db.batch([
    db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)),
    db.insert(passwordResetTokens).values({
      id: await hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    }),
  ]);
  return { token, name: user.name, email: user.email };
}

// Sets a new password if the token is valid, unused and not expired. Returns false otherwise.
// Every session of the account is deleted, so a stolen session (the usual reason to reset)
// stops working too.
export async function resetPassword(db: Db, token: string, password: string): Promise<boolean> {
  const id = await hashToken(token);
  // Hash before claiming the token: hashing is slow, and the claim below should be quick.
  const passwordHash = await hashPassword(password);

  // Claim the token in one conditional update, so two requests with the same link
  // can't both succeed.
  const [claimed] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokens.id, id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: passwordResetTokens.userId });
  if (!claimed) return false;

  await db.batch([
    db.update(users).set({ passwordHash }).where(eq(users.id, claimed.userId)),
    db.delete(sessions).where(eq(sessions.userId, claimed.userId)),
    db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, claimed.userId)),
  ]);
  return true;
}
