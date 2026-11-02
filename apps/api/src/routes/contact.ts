import { createRoute } from "@hono/zod-openapi";
import { contactMessageSchema, contactReceivedSchema } from "@novap/shared";
import { getDb } from "../db/client";
import { createRouter, errors, json } from "../lib/openapi";
import { submitContactMessage } from "../services/contact";

const ContactMessage = contactMessageSchema.openapi("ContactMessage");
const ContactReceived = contactReceivedSchema.openapi("ContactReceived");

// POST /api/contact — public contact form
const submit = createRoute({
  method: "post",
  path: "/",
  tags: ["Contact"],
  summary: "Send a contact message",
  description: "Stores the message for the admin inbox. `email` is lowercased; text fields are trimmed.",
  request: {
    body: { content: { "application/json": { schema: ContactMessage } }, required: true },
  },
  responses: {
    201: json(ContactReceived, "Message received"),
    400: errors[400],
    415: errors[415],
    500: errors[500],
  },
});

export const contactRoute = createRouter().openapi(submit, async (c) => {
  await submitContactMessage(getDb(c.env.DB), c.req.valid("json"));
  return c.json({ received: true as const }, 201);
});
