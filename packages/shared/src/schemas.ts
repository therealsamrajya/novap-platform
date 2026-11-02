import { z } from "zod";

// Phase 1 starter schemas. These move to their own file as each feature is built.

// Cart sent to checkout: ids + quantities only. Prices are never trusted
// from the client — the API looks them up in the database.
export const cartItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
});
export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
  email: z.email().toLowerCase().optional(), // required for guests, ignored for logged-in users
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
