import { getDb } from "./db/client";
import { getMailer } from "./lib/email";
import { getStripe } from "./lib/stripe";
import { deleteExpiredAuthRows, reconcileStaleOrders } from "./services/maintenance";
import { sendOrderConfirmation } from "./services/notifications";

// Cron trigger (wrangler.jsonc "triggers"), every 15 minutes. Not an HTTP request, so no
// Hono context: services get their dependencies straight from env, like in a route.
export const scheduled: ExportedHandlerScheduledHandler<Env> = async (controller, env, ctx) => {
  const db = getDb(env.DB);
  const started = Date.now();

  // Separate try blocks: a Stripe outage shouldn't stop the session clean-up.
  try {
    const { paid, cancelled } = await reconcileStaleOrders(db, getStripe(env));
    // These orders were paid but their webhook was lost, so nobody has emailed the buyer yet.
    const mailer = getMailer(env);
    for (const id of paid) ctx.waitUntil(sendOrderConfirmation(db, mailer, id));
    console.log({ msg: "reconciled stale orders", cron: controller.cron, paid: paid.length, cancelled });
  } catch (err) {
    console.error({ msg: "reconcile run failed", error: err instanceof Error ? err.message : String(err) });
  }

  try {
    await deleteExpiredAuthRows(db);
  } catch (err) {
    console.error({ msg: "auth clean-up failed", error: err instanceof Error ? err.message : String(err) });
  }

  console.log({ msg: "scheduled run done", cron: controller.cron, ms: Date.now() - started });
};
