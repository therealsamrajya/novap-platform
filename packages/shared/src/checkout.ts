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
