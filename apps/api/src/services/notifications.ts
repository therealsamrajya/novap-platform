import type { ContactMessageInput } from "@novap/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { orders } from "../db/schema";
import { contactNotificationEmail } from "../emails/contact-notification";
import { orderConfirmationEmail } from "../emails/order-confirmation";
import { passwordResetEmail } from "../emails/password-reset";
import { verifyEmailEmail } from "../emails/verify-email";
import type { Mailer } from "../lib/email";
import { createVerificationToken, VERIFY_TOKEN_TTL_MS } from "./email-verification";

// Emails run after the response is sent (routes pass these to waitUntil), so they
// never slow down or fail the request that triggered them. A failed send is only
// logged: the order or message is already saved, and that is what matters.

export async function sendOrderConfirmation(db: Db, mailer: Mailer, orderId: number): Promise<void> {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { items: { orderBy: (i, { asc }) => [asc(i.id)] } },
    });
    if (!order) return;
    await mailer(
      orderConfirmationEmail({
        orderId: order.id,
        email: order.email,
        items: order.items.map(({ productName, variantLabel, sku, unitPriceCents, quantity }) => ({
          productName,
          variantLabel,
          sku,
          unitPriceCents,
          quantity,
        })),
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        gstCents: order.gstCents,
        totalCents: order.totalCents,
        shippingAddress: order.shippingAddress,
      }),
    );
  } catch (err) {
    console.error(`Order confirmation email for order #${orderId} failed`, err);
  }
}

export async function sendPasswordReset(
  mailer: Mailer,
  shopUrl: string,
  reset: { token: string; name: string; email: string },
  validMinutes: number,
): Promise<void> {
  try {
    const url = `${shopUrl}/reset-password?token=${encodeURIComponent(reset.token)}`;
    await mailer(passwordResetEmail(reset.email, reset.name, url, validMinutes));
  } catch (err) {
    console.error("Password reset email failed", err);
  }
}

// Creates the token here too, so callers just say "send the user a verification email".
export async function sendEmailVerification(
  db: Db,
  mailer: Mailer,
  shopUrl: string,
  user: { id: number; name: string; email: string },
): Promise<void> {
  try {
    const token = await createVerificationToken(db, user.id);
    const url = `${shopUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await mailer(verifyEmailEmail(user.email, user.name, url, VERIFY_TOKEN_TTL_MS / 3_600_000));
  } catch (err) {
    console.error(`Verification email for user #${user.id} failed`, err);
  }
}

export async function sendContactNotification(
  mailer: Mailer,
  config: { to: string; inboxUrl: string },
  message: ContactMessageInput,
): Promise<void> {
  try {
    await mailer(contactNotificationEmail(config.to, message, config.inboxUrl));
  } catch (err) {
    console.error("Contact notification email failed", err);
  }
}
