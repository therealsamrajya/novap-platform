import { escapeHtml, type Email } from "../lib/email";
import { layout } from "./layout";

export function verifyEmailEmail(to: string, name: string, verifyUrl: string, validHours: number): Email {
  const subject = "Confirm your email for NŌVAP";

  const text = [
    `Hi ${name},`,
    "",
    "Please confirm this is your email address. Once confirmed, orders you placed as a guest",
    "with this email also show up in your account.",
    "",
    verifyUrl,
    "",
    `The link expires in ${validHours} hours. If you didn't create a NŌVAP account, ignore this email.`,
  ].join("\n");

  const html = layout(
    subject,
    `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 24px;">Please confirm this is your email address. Once confirmed, orders you placed as a guest with this email also show up in your account.</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(verifyUrl)}" style="display:inline-block;padding:12px 20px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:6px;">Confirm email</a>
    </p>
    <p style="margin:0;color:#78716c;font-size:13px;">The link expires in ${validHours} hours. If you didn't create a NŌVAP account, ignore this email.</p>`,
  );

  return { to, subject, text, html };
}
