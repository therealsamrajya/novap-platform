import { z } from "zod";

// Cart sent to checkout: ids + quantities only. Prices are never trusted
// from the client — the API looks them up in the database.
export const cartItemSchema = z.object({
  variantId: z.number().int().positive().meta({ example: 3 }),
  quantity: z.number().int().min(1).max(99).meta({ example: 2 }),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const checkoutSchema = z.object({
  items: z
    .array(cartItemSchema)
    .min(1, "Cart is empty")
    .max(50)
    // One line per variant keeps the stock check simple; the cart should merge duplicates.
    .refine((items) => new Set(items.map((i) => i.variantId)).size === items.length, {
      message: "Each variant may appear only once; use quantity instead",
    }),
  email: z
    .email("Enter a valid email address")
    .max(254)
    .toLowerCase()
    .optional()
    .meta({ description: "Required for guests. Ignored when logged in (the account email is used)", example: "alex@example.com" }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const checkoutCreatedSchema = z.object({
  orderId: z.number().int().meta({ example: 12 }),
  checkoutUrl: z.url().meta({ description: "Stripe-hosted payment page. Redirect the browser here", example: "https://checkout.stripe.com/c/pay/cs_test_..." }),
  expiresAt: z.iso.datetime().meta({ description: "Stock is held until then; unpaid orders are cancelled after it" }),
});
export type CheckoutCreated = z.infer<typeof checkoutCreatedSchema>;

export const orderStatusSchema = z
  .enum(["pending", "paid", "fulfilled", "cancelled", "refunded"])
  .meta({ description: "pending = waiting for payment. Only the Stripe webhook moves it to paid", example: "paid" });
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderLineSchema = z.object({
  productName: z.string().meta({ example: "Reference 01" }),
  variantLabel: z.string().meta({ example: "Small" }),
  sku: z.string().meta({ example: "REF01-S" }),
  unitPriceCents: z.number().int().meta({ example: 4995 }),
  quantity: z.number().int().meta({ example: 2 }),
});
export type OrderLine = z.infer<typeof orderLineSchema>;

// Collected by Stripe Checkout and copied onto the order when it is paid.
export const shippingAddressSchema = z.object({
  name: z.string().meta({ example: "Test Customer" }),
  line1: z.string().meta({ example: "1 Test Street" }),
  line2: z.string().nullable().optional(),
  city: z.string().meta({ example: "Sydney" }),
  state: z.string().meta({ example: "NSW" }),
  postcode: z.string().meta({ example: "2000" }),
  country: z.string().meta({ example: "AU" }),
  phone: z.string().nullable().optional().meta({ example: "+61400000000" }),
});

// What the shop's success page shows after Stripe redirects back. No address or
// email: the session id travels in a URL, so it only reveals what was bought.
export const checkoutSessionStatusSchema = z.object({
  orderId: z.number().int().meta({ example: 12 }),
  status: orderStatusSchema,
  subtotalCents: z.number().int().meta({ example: 12485 }),
  shippingCents: z.number().int().meta({ example: 995 }),
  gstCents: z.number().int().meta({ description: "GST included in the total", example: 1225 }),
  totalCents: z.number().int().meta({ example: 13480 }),
  items: z.array(orderLineSchema),
  createdAt: z.iso.datetime(),
});
export type CheckoutSessionStatus = z.infer<typeof checkoutSessionStatusSchema>;
