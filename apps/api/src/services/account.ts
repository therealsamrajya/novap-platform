import type { AccountOrder, AccountOrderListQuery, AccountOrderSummary, Paginated, User } from "@novap/shared";
import { and, count, desc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { Db } from "../db/client";
import { orders } from "../db/schema";
import { pageOffset, paginated } from "../lib/pagination";
import { itemCounts } from "./admin-orders";

type OrderRow = typeof orders.$inferSelect;

const iso = (d: Date | null) => d?.toISOString() ?? null;

// Unpaid (pending) and expired (cancelled) checkouts are not purchases, so the history skips them.
const purchased = ["paid", "fulfilled", "refunded"] as const;

// Orders that belong to the user: placed while logged in, plus guest orders with the same
// email once the user has verified it. Without verification, anyone could register with
// someone else's email and read their orders and address.
function ownedBy(user: User): SQL {
  const own = eq(orders.userId, user.id);
  const guest = and(isNull(orders.userId), eq(orders.email, user.email));
  return user.emailVerified ? or(own, guest)! : own;
}

const toSummary = (row: OrderRow, items: number): AccountOrderSummary => ({
  id: row.id,
  status: row.status,
  totalCents: row.totalCents,
  itemCount: items,
  createdAt: row.createdAt.toISOString(),
  paidAt: iso(row.paidAt),
});

export async function listAccountOrders(
  db: Db,
  user: User,
  query: AccountOrderListQuery,
): Promise<Paginated<AccountOrderSummary>> {
  const { page, limit } = query;
  const where = and(ownedBy(user), inArray(orders.status, [...purchased]));

  const [rows, [counted]] = await db.batch([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit)
      .offset(pageOffset(page, limit)),
    db.select({ total: count() }).from(orders).where(where),
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

// undefined when the order doesn't exist or isn't the user's; the route answers 404 for both.
export async function getAccountOrder(db: Db, user: User, id: number): Promise<AccountOrder | undefined> {
  const row = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), ownedBy(user), inArray(orders.status, [...purchased])),
    with: { items: { orderBy: (item, { asc }) => asc(item.id) } },
  });
  if (!row) return undefined;

  const { items, ...order } = row;
  return {
    ...toSummary(
      order,
      items.reduce((sum, i) => sum + i.quantity, 0),
    ),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    gstCents: order.gstCents,
    shippingAddress: order.shippingAddress ?? null,
    items: items.map(({ productName, variantLabel, sku, unitPriceCents, quantity }) => ({
      productName,
      variantLabel,
      sku,
      unitPriceCents,
      quantity,
    })),
    trackingNumber: order.trackingNumber,
    fulfilledAt: iso(order.fulfilledAt),
  };
}
