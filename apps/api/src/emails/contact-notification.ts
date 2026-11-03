import type { ContactMessageInput } from "@novap/shared";
import { escapeHtml, type Email } from "../lib/email";
import { layout } from "./layout";

// Tells the shop owner a contact form message arrived. Reply-To is the sender,
// so replying in the mail client goes straight to the customer.
export function contactNotificationEmail(
  to: string,
  message: Pick<ContactMessageInput, "name" | "email" | "subject" | "message">,
  inboxUrl: string,
): Email {
  // Subject is user input: strip line breaks so it stays a single header line.
  const subject = `Contact: ${message.subject.replace(/[\r\n]+/g, " ")}`;

  const text = [
    `New message from ${message.name} <${message.email}>`,
    `Subject: ${message.subject}`,
    "",
    message.message,
    "",
    `Inbox: ${inboxUrl}`,
  ].join("\n");

  const html = layout(
    subject,
    `<p style="margin:0 0 4px;color:#78716c;font-size:13px;">New contact message</p>
    <h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(message.subject)}</h1>
    <p style="margin:0 0 16px;"><strong>${escapeHtml(message.name)}</strong> &lt;${escapeHtml(message.email)}&gt;</p>
    <p style="margin:0 0 24px;white-space:pre-wrap;">${escapeHtml(message.message)}</p>
    <p style="margin:0;"><a href="${escapeHtml(inboxUrl)}" style="color:#1c1917;">Open the inbox</a></p>`,
  );

  return { to, subject, text, html, replyTo: message.email };
}
