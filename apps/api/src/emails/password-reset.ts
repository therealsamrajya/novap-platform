import { escapeHtml, type Email } from "../lib/email";
import { layout } from "./layout";

export function passwordResetEmail(to: string, name: string, resetUrl: string, validMinutes: number): Email {
  const subject = "Reset your NŌVAP password";

  const text = [
    `Hi ${name},`,
    "",
    "Someone (hopefully you) asked to reset the password for your NŌVAP account.",
    `Open this link to choose a new one. It works once and expires in ${validMinutes} minutes:`,
    "",
    resetUrl,
    "",
    "If you didn't ask for this, ignore this email. Your password stays the same.",
  ].join("\n");

  const html = layout(
    subject,
    `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 24px;">Someone (hopefully you) asked to reset the password for your NŌVAP account.</p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:6px;">Choose a new password</a>
    </p>
    <p style="margin:0 0 16px;color:#78716c;font-size:13px;">The link works once and expires in ${validMinutes} minutes.</p>
    <p style="margin:0;color:#78716c;font-size:13px;">If you didn't ask for this, ignore this email. Your password stays the same.</p>`,
  );

  return { to, subject, text, html };
}
