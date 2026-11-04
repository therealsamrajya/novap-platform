import { and, asc, eq, lt } from "drizzle-orm";
import type Stripe from "stripe";
import type { Db } from "../db/client";
import { emailVerificationTokens, orders, passwordResetTokens, sessions } from "../db/schema";
import { cancelPendingOrder, HOLD_MINUTES } from "./checkout";
import { expire, markPaid } from "./stripe-webhook";

// Jobs run by the cron trigger (src/scheduled.ts). Each one is safe to run twice or
// at the same time as a webhook: they only change rows still in the expected state.

// A checkout holds stock for HOLD_MINUTES. Pending orders well past that mean the
// `checkout.session.expired` (or `completed`) webhook never arrived.
const STALE_AFTER_MINUTES = HOLD_MINUTES + 15;
// Each order costs one Stripe API call; a small batch keeps a run well inside the time limit.
// Anything left over is picked up 15 minutes later.
const BATCH = 25;

// Asks Stripe what really happened to each stale pending order, instead of assuming it
// expired: if the payment went through and only the webhook was lost, cancelling would
// release stock that was sold. Returns the ids of orders it marked paid, so the caller can
// send their confirmation emails (as the webhook route would have).
export async function reconcileStaleOrders(db: Db, stripe: Stripe): Promise<{ paid: number[]; cancelled: number }> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);
  const stale = await db
    .select({ id: orders.id, stripeSessionId: orders.stripeSessionId })
    .from(orders)
    .where(and(eq(orders.status, "pending"), lt(orders.createdAt, cutoff)))
    .orderBy(asc(orders.id))
    .limit(BATCH);

  const paid: number[] = [];
  let cancelled = 0;
  for (const order of stale) {
    try {
      // No session: the Worker stopped between creating the order and the Stripe call.
      if (!order.stripeSessionId) {
        if (await cancelPendingOrder(db, order.id)) cancelled++;
        continue;
      }
      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      } catch (err) {
        // Stripe has no such session (e.g. made with another key, like test orders after
        // switching to live). It can never be paid, so release the stock.
        if ((err as { code?: string }).code !== "resource_missing") throw err;
        if (await cancelPendingOrder(db, order.id)) cancelled++;
        continue;
      }
      // Still open past its expiry shouldn't happen, but close it at Stripe first so it
      // can't be paid after the stock is released.
      if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id);

      if (session.status === "complete") {
        const id = await markPaid(db, session);
        if (id) paid.push(id);
      } else if (session.status === "expired") {
        if (await expire(db, session)) cancelled++;
      }
    } catch (err) {
      // One bad order (e.g. a session from another Stripe account) must not stop the rest.
      console.error({ msg: "reconcile failed", orderId: order.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { paid, cancelled };
}

// Expired rows are already useless (every lookup checks expiresAt); this just keeps the tables small.
export async function deleteExpiredAuthRows(db: Db): Promise<void> {
  const now = new Date();
  await db.batch([
    db.delete(sessions).where(lt(sessions.expiresAt, now)),
    db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, now)),
    db.delete(emailVerificationTokens).where(lt(emailVerificationTokens.expiresAt, now)),
  ]);
}
