import type { ContactMessageInput } from "@novap/shared";
import type { Db } from "../db/client";
import { contactMessages } from "../db/schema";

// Stores a contact form message for the admin inbox (phase 5).
// Email notification to the shop owner comes in phase 7; rate limiting in phase 9.
export async function submitContactMessage(db: Db, input: ContactMessageInput): Promise<void> {
  // Honeypot filled: almost certainly a bot. Drop it silently so the bot
  // can't tell it was caught.
  if (input.website) return;

  await db.insert(contactMessages).values({
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
  });
}
