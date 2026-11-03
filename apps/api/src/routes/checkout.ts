import { createRoute, z } from "@hono/zod-openapi";
import { checkoutCreatedSchema, checkoutSchema, checkoutSessionStatusSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import { createRouter, errors, json } from "../lib/openapi";
import { getStripe } from "../lib/stripe";
import { createCheckout, getCheckoutSessionStatus, type CheckoutConfig } from "../services/checkout";

const Checkout = checkoutSchema.openapi("Checkout");
const CheckoutCreated = checkoutCreatedSchema.openapi("CheckoutCreated");
const CheckoutSessionStatus = checkoutSessionStatusSchema.openapi("CheckoutSessionStatus");

const checkoutConfig = (env: Env): CheckoutConfig => ({
  shopUrl: env.SHOP_URL,
  shippingFlatCents: Number(env.SHIPPING_FLAT_CENTS),
  freeShippingFromCents: Number(env.FREE_SHIPPING_FROM_CENTS),
});

// POST /api/checkout — reserve stock, create a pending order and a Stripe Checkout Session
const create = createRoute({
  method: "post",
  path: "/",
  tags: ["Checkout"],
  summary: "Start checkout",
  description:
    "Works for guests (send `email`) and logged-in customers (the account email is used). " +
    "Prices come from the database. Stock is held until `expiresAt`; redirect the browser to `checkoutUrl`. " +
    "Shipping is a flat rate, free from a threshold. The order becomes `paid` only through the Stripe webhook.",
  request: {
    body: { content: { "application/json": { schema: Checkout } }, required: true },
  },
  responses: {
    201: json(CheckoutCreated, "Order created; send the buyer to checkoutUrl"),
    400: errors[400],
    409: errors[409],
    415: errors[415],
    500: errors[500],
  },
});

// GET /api/checkout/sessions/:sessionId — order status for the shop's success page
const sessionStatus = createRoute({
  method: "get",
  path: "/sessions/{sessionId}",
  tags: ["Checkout"],
  summary: "Order status after checkout",
  description:
    "Stripe redirects to the shop's success page with `?session_id=...`; pass that id here. " +
    "The status can stay `pending` for a few seconds until the webhook arrives, so poll briefly.",
  request: {
    params: z.object({
      sessionId: z
        .string()
        .regex(/^cs_[A-Za-z0-9_]+$/, "Not a Stripe Checkout Session id")
        .max(255)
        .openapi({ param: { name: "sessionId", in: "path" }, example: "cs_test_a1b2c3" }),
    }),
  },
  responses: {
    200: json(CheckoutSessionStatus, "Order summary"),
    400: errors[400],
    404: errors[404],
    500: errors[500],
  },
});

export const checkoutRoute = createRouter()
  .openapi(create, async (c) => {
    const result = await createCheckout(
      getDb(c.env.DB),
      getStripe(c.env),
      checkoutConfig(c.env),
      c.req.valid("json"),
      c.get("user"),
    );
    return c.json(result, 201);
  })
  .openapi(sessionStatus, async (c) => {
    const status = await getCheckoutSessionStatus(getDb(c.env.DB), c.req.valid("param").sessionId);
    if (!status) throw new HTTPException(404, { message: "Order not found" });
    return c.json(status, 200);
  });
