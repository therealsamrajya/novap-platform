import type { LoginInput, RegisterInput, User } from "@novap/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { sessions, users } from "../db/schema";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../lib/password";
import { hashSessionToken, newSessionToken, sessionTtlMs } from "../lib/session";

type UserRow = typeof users.$inferSelect;

// Explicit mapping so passwordHash can never end up in a response.
const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  createdAt: row.createdAt.toISOString(),
});

// Returns null if the email is already registered. onConflictDoNothing makes the
// unique check and the insert one statement, so two simultaneous sign-ups can't both win.
export async function createUser(db: Db, input: RegisterInput): Promise<User | null> {
  const [row] = await db
    .insert(users)
    .values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) })
    .onConflictDoNothing({ target: users.email })
    .returning();
  return row ? toUser(row) : null;
}

// Returns null for an unknown email or a wrong password; the caller can't tell which (on purpose).
export async function verifyCredentials(db: Db, input: LoginInput): Promise<User | null> {
  const row = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  // Hash even when the user doesn't exist, so both cases take the same time.
  const ok = await verifyPassword(input.password, row?.passwordHash ?? DUMMY_PASSWORD_HASH);
  return row && ok ? toUser(row) : null;
}

export async function createSession(db: Db, user: User): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs(user.role));
  await db.insert(sessions).values({ id: await hashSessionToken(token), userId: user.id, expiresAt });
  return { token, expiresAt };
}

// Looks up the user behind a session token. Expired sessions are deleted here.
// `renewedUntil` is set when the expiry moved, so the caller can refresh the cookie.
export async function getSessionUser(
  db: Db,
  token: string,
): Promise<{ user: User; renewedUntil?: Date } | null> {
  const id = await hashSessionToken(token);
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, id), with: { user: true } });
  if (!session) return null;

  const now = Date.now();
  const remaining = session.expiresAt.getTime() - now;
  if (remaining <= 0) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  // TTL follows the user's current role. Renew when under half is left (sliding), or
  // when it is longer than the role allows (a customer promoted to admin keeps a 30-day
  // session otherwise). Renewing only past halfway avoids a DB write on every request.
  const user = toUser(session.user);
  const ttl = sessionTtlMs(user.role);
  if (remaining < ttl / 2 || remaining > ttl) {
    const renewedUntil = new Date(now + ttl);
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id));
    return { user, renewedUntil };
  }
  return { user };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, await hashSessionToken(token)));
}
