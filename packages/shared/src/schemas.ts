import { z } from "zod";

// Phase 1 starter schemas. These grow as each feature is built.

export const registerSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(10, "Password must be at least 10 characters").max(128),
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

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
