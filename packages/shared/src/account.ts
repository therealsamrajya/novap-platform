import { z } from "zod";
import { paginationQuerySchema } from "./api";
import { orderLineSchema, orderStatusSchema, shippingAddressSchema } from "./checkout";

// The logged-in customer's own orders. No Stripe ids or internal fields: only what
// the customer needs to see, like a receipt.

export const accountOrderListQuerySchema = paginationQuerySchema;
export type AccountOrderListQuery = z.output<typeof accountOrderListQuerySchema>;

export const accountOrderSummarySchema = z.object({
  id: z.number().int().meta({ example: 2 }),
  status: orderStatusSchema,
  totalCents: z.number().int().meta({ example: 11985 }),
  itemCount: z.number().int().meta({ description: "Total quantity across all lines", example: 2 }),
  createdAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
});
export type AccountOrderSummary = z.infer<typeof accountOrderSummarySchema>;

export const accountOrderSchema = accountOrderSummarySchema.extend({
  subtotalCents: z.number().int().meta({ example: 10990 }),
  shippingCents: z.number().int().meta({ example: 995 }),
  gstCents: z.number().int().meta({ description: "GST included in the total", example: 1090 }),
  shippingAddress: shippingAddressSchema.nullable(),
  items: z.array(orderLineSchema),
  trackingNumber: z.string().nullable().meta({ example: "AP123456789AU" }),
  fulfilledAt: z.iso.datetime().nullable().meta({ description: "When it was shipped" }),
});
export type AccountOrder = z.infer<typeof accountOrderSchema>;
