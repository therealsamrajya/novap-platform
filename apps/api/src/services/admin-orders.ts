import type { AdminOrder, AdminOrderListQuery, AdminOrderSummary, OrderUpdateInput, Paginated } from "@novap/shared";
import { and, count, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { Db } from "../db/client";
import { orderItems, orders } from "../db/schema";
import { pageOffset, paginated } from "../lib/pagination";
import { containsText } from "../lib/sql";

// Admin order management. Orders are created by checkout (services/checkout.ts) and
// moved to paid / cancelled / refunded only by the Stripe webhook. The one manual
// step is shipping: paid → fulfilled, with an optional tracking number.

type OrderRow = typeof orders.$inferSelect;

const iso = (d: Date | null) => d?.toISOString() ?? null;

// Total quantity per order, for one page of orders. A separate grouped query rather than a
// correlated subquery: in a single-table select Drizzle leaves column names unqualified, so
// "order_id = id" inside the subquery would compare order_items with itself.
// Also used by the customer's order history (services/account.ts).
export async function itemCounts(db: Db, orderIds: number[]): Promise<Map<number, number>> {
  if (orderIds.length === 0) return new Map();
  const rows = await db
    .select({ orderId: orderItems.orderId, quantity: sql<number>`sum(${orderItems.quantity})`.mapWith(Number) })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds))
    .groupBy(orderItems.orderId);
  return new Map(rows.map((r) => [r.orderId, r.quantity]));
}

const toSummary = (row: OrderRow, items: number): AdminOrderSummary => ({
  id: row.id,
  email: row.email,
  userId: row.userId,
  status: row.status,
  totalCents: row.totalCents,
  itemCount: items,
  createdAt: row.createdAt.toISOString(),
  paidAt: iso(row.paidAt),
});

export async function listOrders(db: Db, query: AdminOrderListQuery): Promise<Paginated<AdminOrderSummary>> {
  const { status, q, page, limit } = query;

  // No status filter: everything except pending. Pending orders are checkouts that
  // were never paid (yet), which would bury the orders that need shipping.
  const where: SQL[] = [status ? eq(orders.status, status) : ne(orders.status, "pending")];
  if (q) {
    // "12" or "#12" also matches order number 12.
    const id = /^#?\d{1,9}$/.test(q) ? Number(q.replace("#", "")) : undefined;
    where.push(id === undefined ? containsText(orders.email, q) : or(eq(orders.id, id), containsText(orders.email, q))!);
  }

  const [rows, [counted]] = await db.batch([
    db
      .select()
      .from(orders)
      .where(and(...where))
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit)
      .offset(pageOffset(page, limit)),
    db.select({ total: count() }).from(orders).where(and(...where)),
  ]);

  const counts = await itemCounts(
    db,
    rows.map((r) => r.id),
  );
  return paginated(
    rows.map((r) => toSummary(r, counts.get(r.id) ?? 0)),
    counted?.total ?? 0,
    page,
    limit,
  );
}

export async function getOrder(db: Db, id: number): Promise<AdminOrder | undefined> {
  const row = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      items: { orderBy: (item, { asc }) => asc(item.id) },
      user: { columns: { id: true, name: true, email: true } },
    },
  });
  if (!row) return undefined;

  const { items, user, ...order } = row;
  return {
    ...toSummary(
      order,
      items.reduce((sum, i) => sum + i.quantity, 0),
    ),
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    gstCents: order.gstCents,
    shippingAddress: order.shippingAddress ?? null,
    items: items.map(({ variantId, productName, variantLabel, sku, unitPriceCents, quantity }) => ({
      variantId,
      productName,
      variantLabel,
      sku,
      unitPriceCents,
      quantity,
    })),
    customer: user ?? null,
    trackingNumber: order.trackingNumber,
    fulfilledAt: iso(order.fulfilledAt),
    stripeSessionId: order.stripeSessionId,
    stripePaymentIntentId: order.stripePaymentIntentId,
    updatedAt: order.updatedAt.toISOString(),
  };
}

// Only paid or already-shipped orders can be fulfilled or get a tracking number.
// The update is conditional on that status, so a refund webhook arriving at the
// same moment can't be overwritten by a stale "fulfilled".
const shippable = ["paid", "fulfilled"] as const;

export async function updateOrder(db: Db, id: number, input: OrderUpdateInput): Promise<AdminOrder | undefined> {
  const current = await db.query.orders.findFirst({ columns: { status: true, fulfilledAt: true }, where: eq(orders.id, id) });
  if (!current) return undefined;
  if (!shippable.includes(current.status as (typeof shippable)[number])) {
    throw new HTTPException(409, { message: `Only paid orders can be shipped; this order is ${current.status}` });
  }

  const [updated] = await db
    .update(orders)
    .set({
      ...(input.trackingNumber !== undefined && { trackingNumber: input.trackingNumber }),
      // Keep the first fulfilment time if it is marked fulfilled again.
      ...(input.status === "fulfilled" && { status: "fulfilled" as const, fulfilledAt: current.fulfilledAt ?? new Date() }),
    })
    .where(and(eq(orders.id, id), inArray(orders.status, [...shippable])))
    .returning({ id: orders.id });
  if (!updated) throw new HTTPException(409, { message: "The order changed meanwhile; reload it and try again" });

  return getOrder(db, id);
}
