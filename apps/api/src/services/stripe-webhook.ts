import { and, eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import type { Db } from "../db/client";
import { orders, stripeEvents, type ShippingAddress } from "../db/schema";
import { cancelPendingOrder } from "./checkout";

// Handles a Stripe event whose signature was already checked (routes/stripe.ts).
//
// Stripe may deliver an event more than once, out of order, or retry it after a
// failure. So every handler is idempotent on its own: it only changes an order that
// is still in the expected status. stripe_events is recorded only after success,
// so a failed attempt is retried by Stripe instead of being skipped as a duplicate.
//
// Returns the id of an order this event moved to `paid` (null otherwise), so the route
// sends the confirmation email exactly once: a duplicate event finds the order already paid.
export async function handleStripeEvent(db: Db, event: Stripe.Event): Promise<{ paidOrderId: number | null }> {
  let paidOrderId: number | null = null;
  const seen = await db.query.stripeEvents.findFirst({ columns: { id: true }, where: eq(stripeEvents.id, event.id) });
  if (seen) return { paidOrderId };

  switch (event.type) {
    case "checkout.session.completed":
      paidOrderId = await markPaid(db, event.data.object);
      break;
    case "checkout.session.expired":
      await expire(db, event.data.object);
      break;
    case "charge.refunded":
      await markRefunded(db, event.data.object);
      break;
    // Anything else (if the endpoint is subscribed to more) is acknowledged and ignored.
  }

  await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
  return { paidOrderId };
}

// Returns the order id when this call changed it from pending to paid.
async function markPaid(db: Db, session: Stripe.Checkout.Session): Promise<number | null> {
  // Cards only (services/checkout.ts), so a completed session is always paid.
  // Guard anyway: a delayed method would arrive here as "unpaid".
  if (session.payment_status !== "paid") return null;

  const [paid] = await db
    .update(orders)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: idOf(session.payment_intent),
      shippingAddress: shippingAddressOf(session),
    })
    .where(and(eq(orders.stripeSessionId, session.id), eq(orders.status, "pending")))
    .returning({ id: orders.id });

  if (!paid) {
    // Already paid (duplicate) is fine. A cancelled order that got paid means its stock
    // was already released: that needs a person (refund, or re-check stock and ship).
    const order = await db.query.orders.findFirst({
      columns: { id: true, status: true },
      where: eq(orders.stripeSessionId, session.id),
    });
    if (order?.status !== "paid") {
      console.error(`Stripe session ${session.id} paid, but order is ${order ? `#${order.id} ${order.status}` : "missing"}`);
    }
    return null;
  }
  return paid.id;
}

async function expire(db: Db, session: Stripe.Checkout.Session) {
  const order = await db.query.orders.findFirst({
    columns: { id: true },
    where: eq(orders.stripeSessionId, session.id),
  });
  if (order) await cancelPendingOrder(db, order.id);
}

// Full refunds only. A partial refund leaves the order as it is; the admin sees
// the details in Stripe. Stock is not put back: a refunded item may not be resellable.
async function markRefunded(db: Db, charge: Stripe.Charge) {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!charge.refunded || !paymentIntentId) return;

  await db
    .update(orders)
    .set({ status: "refunded" })
    .where(and(eq(orders.stripePaymentIntentId, paymentIntentId), inArray(orders.status, ["paid", "fulfilled"])));
}

// Stripe fields like payment_intent are an id, or the full object when expanded.
const idOf = (value: string | { id: string } | null) => (typeof value === "string" ? value : (value?.id ?? null));

function shippingAddressOf(session: Stripe.Checkout.Session): ShippingAddress | null {
  const shipping = session.collected_information?.shipping_details;
  if (!shipping) return null;
  const { address } = shipping;
  return {
    name: shipping.name,
    line1: address.line1 ?? "",
    line2: address.line2,
    city: address.city ?? "",
    state: address.state ?? "",
    postcode: address.postal_code ?? "",
    country: address.country ?? "AU",
    phone: session.customer_details?.phone ?? null,
  };
}
