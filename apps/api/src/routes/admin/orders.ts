import { createRoute } from "@hono/zod-openapi";
import { adminOrderListQuerySchema, adminOrderSchema, adminOrderSummarySchema, orderUpdateSchema, paginatedSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../../db/client";
import { adminTags, cookieAuth, createRouter, errors, idParams, json } from "../../lib/openapi";
import { getOrder, listOrders, updateOrder } from "../../services/admin-orders";

const AdminOrderSummary = adminOrderSummarySchema.openapi("AdminOrderSummary");
const AdminOrder = adminOrderSchema.openapi("AdminOrder");
const OrderUpdate = orderUpdateSchema.openapi("OrderUpdate");

// Every route here sits behind requireAdmin (index.ts).
const admin = { tags: [adminTags.orders], security: cookieAuth };
const guarded = { 401: errors[401], 403: errors[403], 500: errors[500] };
const notFound = () => new HTTPException(404, { message: "Order not found" });

// GET /api/admin/orders — orders, newest first
const list = createRoute({
  ...admin,
  method: "get",
  path: "/",
  summary: "List orders",
  description:
    "Newest first. Without `status`, pending (unpaid) checkouts are left out. " +
    "`?status=paid` is the list of orders waiting to be shipped.",
  request: { query: adminOrderListQuerySchema },
  responses: {
    200: json(paginatedSchema(AdminOrderSummary).openapi("AdminOrderSummaryPage"), "One page of orders"),
    400: errors[400],
    ...guarded,
  },
});

// GET /api/admin/orders/:id — one order with items, address and Stripe ids
const getOne = createRoute({
  ...admin,
  method: "get",
  path: "/{id}",
  summary: "Get an order",
  request: { params: idParams(4) },
  responses: { 200: json(AdminOrder, "Order"), 400: errors[400], 404: errors[404], ...guarded },
});

// PATCH /api/admin/orders/:id — mark shipped and/or set the tracking number
const update = createRoute({
  ...admin,
  method: "patch",
  path: "/{id}",
  summary: "Ship an order",
  description:
    "`status: \"fulfilled\"` marks a paid order as shipped. `trackingNumber` can be set or changed on paid " +
    "and fulfilled orders. Other statuses are a 409: payment, cancellation and refunds come only from Stripe " +
    "(refund in the Stripe dashboard; the webhook then marks the order refunded).",
  request: {
    params: idParams(4),
    body: { content: { "application/json": { schema: OrderUpdate } }, required: true },
  },
  responses: {
    200: json(AdminOrder, "Updated"),
    400: errors[400],
    404: errors[404],
    409: errors[409],
    415: errors[415],
    ...guarded,
  },
});

export const adminOrdersRoute = createRouter()
  .openapi(list, async (c) => c.json(await listOrders(getDb(c.env.DB), c.req.valid("query")), 200))
  .openapi(getOne, async (c) => {
    const order = await getOrder(getDb(c.env.DB), c.req.valid("param").id);
    if (!order) throw notFound();
    return c.json(order, 200);
  })
  .openapi(update, async (c) => {
    const order = await updateOrder(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!order) throw notFound();
    return c.json(order, 200);
  });
