import { createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import { getMailer } from "../lib/email";
import { createRouter, errors, json } from "../lib/openapi";
import { getStripe } from "../lib/stripe";
import { sendOrderConfirmation } from "../services/notifications";
import { handleStripeEvent } from "../services/stripe-webhook";

// POST /api/stripe/webhook — events from Stripe (payment completed, session expired, refund)
// Called by Stripe's servers, not a browser: no session or CORS involved. The signature
// header is the only authentication, so the raw body must be verified before anything else.
const webhook = createRoute({
  method: "post",
  path: "/webhook",
  tags: ["Checkout"],
  summary: "Stripe webhook",
  description:
    "Only Stripe calls this. Verifies the `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`. " +
    "Handles `checkout.session.completed` (order paid), `checkout.session.expired` (order cancelled, stock released) " +
    "and `charge.refunded` (full refund). A newly paid order gets a confirmation email, sent after the response. " +
    "Repeated events are ignored. Locally: " +
    "`stripe listen --events checkout.session.completed,checkout.session.expired,charge.refunded --forward-to localhost:8787/api/stripe/webhook`.",
  request: {
    headers: z.object({
      "stripe-signature": z.string().min(1).openapi({ description: "Set by Stripe", example: "t=1700000000,v1=..." }),
    }),
  },
  responses: {
    200: json(z.object({ received: z.literal(true) }), "Event accepted (or a duplicate, ignored)"),
    400: errors[400],
    500: errors[500],
  },
});

export const stripeRoute = createRouter().openapi(webhook, async (c) => {
  // The signature covers the exact bytes Stripe sent, so read the raw text, not parsed JSON.
  const body = await c.req.text();
  let event;
  try {
    event = await getStripe(c.env).webhooks.constructEventAsync(
      body,
      c.req.valid("header")["stripe-signature"],
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new HTTPException(400, { message: "Invalid Stripe signature" });
  }
  // A thrown error becomes a 500, and Stripe retries the event later.
  const db = getDb(c.env.DB);
  const { paidOrderId } = await handleStripeEvent(db, event);
  // After the response: Stripe gets its 200 fast, and a failed email can't trigger a retry.
  if (paidOrderId) c.executionCtx.waitUntil(sendOrderConfirmation(db, getMailer(c.env), paidOrderId));
  return c.json({ received: true as const }, 200);
});
