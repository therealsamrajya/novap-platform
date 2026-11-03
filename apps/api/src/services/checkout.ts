import {
  CURRENCY,
  gstFromInclusive,
  type CheckoutCreated,
  type CheckoutInput,
  type CheckoutSessionStatus,
  type User,
} from "@novap/shared";
import { and, eq, exists, gte, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type Stripe from "stripe";
import type { Db } from "../db/client";
import { orderItems, orders, products, variants } from "../db/schema";

// Checkout flow:
//   1. read prices + stock from D1 (never from the client)
//   2. reserve stock (decrement now, so two buyers can't pay for the last unit)
//   3. save a "pending" order with a snapshot of each item
//   4. create the Stripe Checkout Session and send the buyer there
// Only the signed webhook marks an order paid. An unpaid session expires, and the
// webhook then cancels the order and puts the stock back (cancelPendingOrder).

// Stripe requires a session to stay open at least 30 minutes; one more avoids
// a rejection from clock skew between the Worker and Stripe.
const HOLD_MINUTES = 31;

export type CheckoutConfig = {
  shopUrl: string;
  shippingFlatCents: number;
  freeShippingFromCents: number;
};

type Line = {
  variantId: number;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
};

export const shippingFor = (subtotalCents: number, config: CheckoutConfig) =>
  subtotalCents >= config.freeShippingFromCents ? 0 : config.shippingFlatCents;

export async function createCheckout(
  db: Db,
  stripe: Stripe,
  config: CheckoutConfig,
  input: CheckoutInput,
  user: User | null,
): Promise<CheckoutCreated> {
  // Logged in: the order belongs to the account, so the account email wins.
  const email = user?.email ?? input.email;
  if (!email) throw new HTTPException(400, { message: "Email is required for guest checkout" });

  const lines = await priceCart(db, input.items);
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const shippingCents = shippingFor(subtotalCents, config);
  const totalCents = subtotalCents + shippingCents;

  await reserveStock(db, lines);

  let orderId: number;
  try {
    const [order] = await db
      .insert(orders)
      .values({
        userId: user?.id ?? null,
        email,
        currency: CURRENCY,
        subtotalCents,
        shippingCents,
        gstCents: gstFromInclusive(totalCents),
        totalCents,
      })
      .returning({ id: orders.id });
    orderId = order!.id;
    await db.insert(orderItems).values(lines.map((l) => ({ ...l, orderId })));
  } catch (err) {
    await addStock(db, lines);
    throw err;
  }

  // From here on the order exists, so undo goes through cancelPendingOrder.
  const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        // Cards only: they settle instantly, so "session completed" always means paid.
        // Delayed methods (e.g. BECS direct debit) would need the async_payment_* events.
        allowed_payment_method_types: ["card"],
        customer_email: email,
        client_reference_id: String(orderId),
        metadata: { orderId: String(orderId) },
        line_items: lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: CURRENCY,
            unit_amount: l.unitPriceCents,
            product_data: { name: `${l.productName} — ${l.variantLabel}`, metadata: { sku: l.sku } },
          },
        })),
        shipping_address_collection: { allowed_countries: ["AU"] },
        phone_number_collection: { enabled: true },
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              display_name: shippingCents ? "Standard shipping" : "Free shipping",
              fixed_amount: { amount: shippingCents, currency: CURRENCY },
            },
          },
        ],
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        success_url: `${config.shopUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.shopUrl}/cart`,
      },
      // A retried request (network blip) returns the same session instead of a second one.
      { idempotencyKey: `checkout-order-${orderId}` },
    );
  } catch (err) {
    await cancelPendingOrder(db, orderId);
    throw err;
  }

  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, orderId));

  return { orderId, checkoutUrl: session.url!, expiresAt: expiresAt.toISOString() };
}

// Current price, name and stock for each cart line. 409 if something can't be bought,
// so the shop can refresh the cart and show the message.
async function priceCart(db: Db, items: CheckoutInput["items"]): Promise<Line[]> {
  const rows = await db
    .select({
      variantId: variants.id,
      productName: products.name,
      variantLabel: variants.label,
      sku: variants.sku,
      unitPriceCents: variants.priceCents,
      stock: variants.stock,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(
      and(
        inArray(
          variants.id,
          items.map((i) => i.variantId),
        ),
        eq(variants.active, true),
        eq(products.active, true),
      ),
    );
  const byId = new Map(rows.map((r) => [r.variantId, r]));

  return items.map(({ variantId, quantity }) => {
    const row = byId.get(variantId);
    if (!row) throw new HTTPException(409, { message: `Item ${variantId} is no longer available` });
    const { stock, ...line } = row;
    if (stock < quantity) throw new HTTPException(409, { message: outOfStock(line, stock) });
    return { ...line, quantity };
  });
}

const outOfStock = (l: Pick<Line, "productName" | "variantLabel">, stock: number) =>
  stock > 0
    ? `${l.productName} (${l.variantLabel}): only ${stock} left`
    : `${l.productName} (${l.variantLabel}) is sold out`;

// Each decrement only applies if enough stock is left at that moment, so two
// checkouts racing for the last unit can't both win. D1 has no transactions to
// roll back a partial result, so lines already taken are given back by hand.
async function reserveStock(db: Db, lines: Line[]) {
  const [first, ...rest] = lines.map((l) =>
    db
      .update(variants)
      .set({ stock: sql`${variants.stock} - ${l.quantity}` })
      .where(and(eq(variants.id, l.variantId), gte(variants.stock, l.quantity)))
      .returning({ stock: variants.stock }),
  );
  const results = await db.batch([first!, ...rest]);

  const missed = lines.findIndex((_, i) => results[i]!.length === 0);
  if (missed === -1) return;
  await addStock(
    db,
    lines.filter((_, i) => results[i]!.length > 0),
  );
  throw new HTTPException(409, { message: `${outOfStock(lines[missed]!, 0)}. Someone just bought the last one` });
}

async function addStock(db: Db, lines: Pick<Line, "variantId" | "quantity">[]) {
  const [first, ...rest] = lines.map((l) =>
    db
      .update(variants)
      .set({ stock: sql`${variants.stock} + ${l.quantity}` })
      .where(eq(variants.id, l.variantId)),
  );
  if (first) await db.batch([first, ...rest]);
}

// Cancels an order that was never paid and puts its stock back. Safe to call
// twice (e.g. a repeated webhook): it only acts while the order is still pending.
// Both statements run in one atomic batch, restock first, so stock can't be
// returned without the cancel or the other way round.
export async function cancelPendingOrder(db: Db, orderId: number): Promise<boolean> {
  const isPending = exists(
    db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending"))),
  );
  const itemVariantIds = db
    .select({ id: orderItems.variantId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const [, cancelled] = await db.batch([
    db
      .update(variants)
      .set({
        stock: sql`${variants.stock} + (select sum(${orderItems.quantity}) from ${orderItems} where ${orderItems.orderId} = ${orderId} and ${orderItems.variantId} = ${variants.id})`,
      })
      .where(and(inArray(variants.id, itemVariantIds), isPending)),
    db
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id }),
  ]);
  return cancelled.length > 0;
}

// For the shop's success page. Right after the redirect the status may still be
// "pending" for a few seconds, until Stripe's webhook arrives; the page can poll.
export async function getCheckoutSessionStatus(db: Db, sessionId: string): Promise<CheckoutSessionStatus | undefined> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.stripeSessionId, sessionId),
    with: { items: { orderBy: (item, { asc }) => asc(item.id) } },
  });
  if (!order) return undefined;
  return {
    orderId: order.id,
    status: order.status,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    gstCents: order.gstCents,
    totalCents: order.totalCents,
    items: order.items.map(({ productName, variantLabel, sku, unitPriceCents, quantity }) => ({
      productName,
      variantLabel,
      sku,
      unitPriceCents,
      quantity,
    })),
    createdAt: order.createdAt.toISOString(),
  };
}
