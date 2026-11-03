import type { ContactMessageInput } from "@novap/shared";
import type { Db } from "../db/client";
import { contactMessages } from "../db/schema";

// Stores a contact form message for the admin inbox (routes/admin/contact.ts).
// Returns false when the message was dropped, so the route doesn't email the owner about it.
// Rate limiting comes in phase 9.
export async function submitContactMessage(db: Db, input: ContactMessageInput): Promise<boolean> {
  // Honeypot filled: almost certainly a bot. Drop it silently so the bot
  // can't tell it was caught.
  if (input.website) return false;

  await db.insert(contactMessages).values({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
  });
  return true;
}
