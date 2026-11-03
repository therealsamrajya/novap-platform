import { createRoute } from "@hono/zod-openapi";
import { checkoutCreatedSchema, checkoutSchema } from "@novap/shared";
import { getDb } from "../db/client";
import { createRouter, errors, json } from "../lib/openapi";
import { getStripe } from "../lib/stripe";
import { createCheckout, type CheckoutConfig } from "../services/checkout";

const Checkout = checkoutSchema.openapi("Checkout");
const CheckoutCreated = checkoutCreatedSchema.openapi("CheckoutCreated");

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

export const checkoutRoute = createRouter().openapi(create, async (c) => {
  const result = await createCheckout(
    getDb(c.env.DB),
    getStripe(c.env),
    checkoutConfig(c.env),
    c.req.valid("json"),
    c.get("user"),
  );
  return c.json(result, 201);
});
