import { createRoute } from "@hono/zod-openapi";
import { contactMessageSchema, contactReceivedSchema } from "@novap/shared";
import { getDb } from "../db/client";
import { getMailer } from "../lib/email";
import { createRouter, errors, json } from "../lib/openapi";
import { submitContactMessage } from "../services/contact";
import { sendContactNotification } from "../services/notifications";

const ContactMessage = contactMessageSchema.openapi("ContactMessage");
const ContactReceived = contactReceivedSchema.openapi("ContactReceived");

// POST /api/contact — public contact form
const submit = createRoute({
  method: "post",
  path: "/",
  tags: ["Contact"],
  summary: "Send a contact message",
  description:
    "Stores the message for the admin inbox and emails the shop owner (`ADMIN_NOTIFY_EMAIL`, Reply-To set to the sender). " +
    "`email` is lowercased; text fields are trimmed.",
  request: {
    body: { content: { "application/json": { schema: ContactMessage } }, required: true },
  },
  responses: {
    201: json(ContactReceived, "Message received"),
    400: errors[400],
    415: errors[415],
    429: errors[429],
    500: errors[500],
  },
});

export const contactRoute = createRouter().openapi(submit, async (c) => {
  const input = c.req.valid("json");
  const saved = await submitContactMessage(getDb(c.env.DB), input);
  if (saved) {
    const config = { to: c.env.ADMIN_NOTIFY_EMAIL, inboxUrl: `${c.env.ADMIN_URL}/contact` };
    c.executionCtx.waitUntil(sendContactNotification(getMailer(c.env), config, input));
  }
  return c.json({ received: true as const }, 201);
});
