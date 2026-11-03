import { createRoute } from "@hono/zod-openapi";
import { adminContactListQuerySchema, adminContactMessageSchema, contactUpdateSchema, paginatedSchema } from "@novap/shared";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../../db/client";
import { adminTags, cookieAuth, createRouter, errors, idParams, json } from "../../lib/openapi";
import {
  deleteContactMessage,
  getContactMessage,
  listContactMessages,
  updateContactMessage,
} from "../../services/admin-contact";

const AdminContactMessage = adminContactMessageSchema.openapi("AdminContactMessage");
const ContactUpdate = contactUpdateSchema.openapi("ContactUpdate");

// Every route here sits behind requireAdmin (index.ts).
const admin = { tags: [adminTags.contact], security: cookieAuth };
const guarded = { 401: errors[401], 403: errors[403], 500: errors[500] };
const notFound = () => new HTTPException(404, { message: "Message not found" });

// GET /api/admin/contact — inbox, newest first
const list = createRoute({
  ...admin,
  method: "get",
  path: "/",
  summary: "List contact messages",
  description:
    "Newest first. Without `status`, archived messages are left out (the inbox view). " +
    "`?status=new` gives the unread count in `total`.",
  request: { query: adminContactListQuerySchema },
  responses: {
    200: json(paginatedSchema(AdminContactMessage).openapi("AdminContactMessagePage"), "One page of messages"),
    400: errors[400],
    ...guarded,
  },
});

// GET /api/admin/contact/:id — one message
const getOne = createRoute({
  ...admin,
  method: "get",
  path: "/{id}",
  summary: "Get a contact message",
  description: "Doesn't mark the message as read; send `PATCH { status: \"read\" }` for that.",
  request: { params: idParams(1) },
  responses: { 200: json(AdminContactMessage, "Message"), 400: errors[400], 404: errors[404], ...guarded },
});

// PATCH /api/admin/contact/:id — mark as new / read / archived
const update = createRoute({
  ...admin,
  method: "patch",
  path: "/{id}",
  summary: "Change a message's status",
  request: {
    params: idParams(1),
    body: { content: { "application/json": { schema: ContactUpdate } }, required: true },
  },
  responses: {
    200: json(AdminContactMessage, "Updated"),
    400: errors[400],
    404: errors[404],
    415: errors[415],
    ...guarded,
  },
});

// DELETE /api/admin/contact/:id — delete a message
const remove = createRoute({
  ...admin,
  method: "delete",
  path: "/{id}",
  summary: "Delete a contact message",
  description: "Permanent. To keep it but hide it from the inbox, set `status: \"archived\"`.",
  request: { params: idParams(1) },
  responses: { 204: { description: "Deleted" }, 400: errors[400], 404: errors[404], ...guarded },
});

export const adminContactRoute = createRouter()
  .openapi(list, async (c) => c.json(await listContactMessages(getDb(c.env.DB), c.req.valid("query")), 200))
  .openapi(getOne, async (c) => {
    const message = await getContactMessage(getDb(c.env.DB), c.req.valid("param").id);
    if (!message) throw notFound();
    return c.json(message, 200);
  })
  .openapi(update, async (c) => {
    const message = await updateContactMessage(getDb(c.env.DB), c.req.valid("param").id, c.req.valid("json"));
    if (!message) throw notFound();
    return c.json(message, 200);
  })
  .openapi(remove, async (c) => {
    if (!(await deleteContactMessage(getDb(c.env.DB), c.req.valid("param").id))) throw notFound();
    return c.body(null, 204);
  });
