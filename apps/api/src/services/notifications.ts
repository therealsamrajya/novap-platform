import type { ContactMessageInput } from "@novap/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { orders } from "../db/schema";
import { contactNotificationEmail } from "../emails/contact-notification";
import { orderConfirmationEmail } from "../emails/order-confirmation";
import type { Mailer } from "../lib/email";

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
