import { createRoute } from "@hono/zod-openapi";
import { accountOrderListQuerySchema, accountOrderSchema, accountOrderSummarySchema, paginatedSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../db/client";
import { cookieAuth, createRouter, errors, idParams, json } from "../lib/openapi";
import { currentUser } from "../middleware/auth";
import { getAccountOrder, listAccountOrders } from "../services/account";

const AccountOrderSummary = accountOrderSummarySchema.openapi("AccountOrderSummary");
const AccountOrder = accountOrderSchema.openapi("AccountOrder");

const ownership =
  "Includes orders placed while logged in and, once the email is confirmed (`User.emailVerified`), " +
  "guest orders placed with the same email. Only paid, fulfilled and refunded orders; unfinished checkouts are left out.";

// GET /api/account/orders — the logged-in customer's order history
const list = createRoute({
  method: "get",
  path: "/orders",
  tags: ["Account"],
  summary: "My orders",
  description: `Newest first. ${ownership}`,
  security: cookieAuth,
  request: { query: accountOrderListQuerySchema },
  responses: {
    200: json(paginatedSchema(AccountOrderSummary), "One page of orders"),
    400: errors[400],
    401: errors[401],
    500: errors[500],
  },
});

// GET /api/account/orders/:id — one of the customer's orders, with items and address
const getOne = createRoute({
  method: "get",
  path: "/orders/{id}",
  tags: ["Account"],
  summary: "My order",
  description: `${ownership} Someone else's order is a 404, the same as a missing one.`,
  security: cookieAuth,
  request: { params: idParams(2) },
  responses: {
    200: json(AccountOrder, "The order"),
    400: errors[400],
    401: errors[401],
    404: errors[404],
    500: errors[500],
  },
});

export const accountRoute = createRouter()
  .openapi(list, async (c) => {
    const page = await listAccountOrders(getDb(c.env.DB), currentUser(c), c.req.valid("query"));
    return c.json(page, 200);
  })
  .openapi(getOne, async (c) => {
    const order = await getAccountOrder(getDb(c.env.DB), currentUser(c), c.req.valid("param").id);
    if (!order) throw new HTTPException(404, { message: "Order not found" });
    return c.json(order, 200);
  });
