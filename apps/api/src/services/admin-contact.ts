import type { AdminContactListQuery, AdminContactMessage, ContactUpdateInput, Paginated } from "@novap/shared";
import { and, count, desc, eq, ne, or, type SQL } from "drizzle-orm";
import type { Db } from "../db/client";
import { contactMessages } from "../db/schema";
import { pageOffset, paginated } from "../lib/pagination";
import { containsText } from "../lib/sql";

// Admin contact inbox. Messages arrive through POST /api/contact (services/contact.ts).
// Reading a message doesn't change its status: the dashboard sets "read" explicitly,
// so a GET never has side effects.

type ContactRow = typeof contactMessages.$inferSelect;

const toAdminMessage = (row: ContactRow): AdminContactMessage => ({
  id: row.id,
  name: row.name,
  email: row.email,
  subject: row.subject,
  message: row.message,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
});

export async function listContactMessages(db: Db, query: AdminContactListQuery): Promise<Paginated<AdminContactMessage>> {
  const { status, q, page, limit } = query;

  // No status filter = the inbox view: everything except archived.
  const where: SQL[] = [status ? eq(contactMessages.status, status) : ne(contactMessages.status, "archived")];
  if (q) {
    where.push(
      or(containsText(contactMessages.name, q), containsText(contactMessages.email, q), containsText(contactMessages.subject, q))!,
    );
  }

  const [rows, [counted]] = await db.batch([
    db
      .select()
      .from(contactMessages)
      .where(and(...where))
      .orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
      .limit(limit)
      .offset(pageOffset(page, limit)),
    db.select({ total: count() }).from(contactMessages).where(and(...where)),
  ]);

  return paginated(rows.map(toAdminMessage), counted?.total ?? 0, page, limit);
}

export async function getContactMessage(db: Db, id: number): Promise<AdminContactMessage | undefined> {
  const row = await db.query.contactMessages.findFirst({ where: eq(contactMessages.id, id) });
  return row && toAdminMessage(row);
}

export async function updateContactMessage(
  db: Db,
  id: number,
  input: ContactUpdateInput,
): Promise<AdminContactMessage | undefined> {
  const [row] = await db.update(contactMessages).set(input).where(eq(contactMessages.id, id)).returning();
  return row && toAdminMessage(row);
}

export async function deleteContactMessage(db: Db, id: number): Promise<boolean> {
  const deleted = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ id: contactMessages.id });
  return deleted.length > 0;
}
