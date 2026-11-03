// Sends email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Plain fetch instead of the SDK: one endpoint, and nothing extra to bundle into the Worker.

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type Mailer = (email: Email) => Promise<void>;

// Without an API key outside production, emails are printed to the wrangler dev console
// instead of sent, so local work needs no Resend account. Production without a key is a
// config mistake, so it throws instead of silently dropping customer emails.
export function getMailer(env: Env): Mailer {
  const isProduction = (env.APP_ENV as string) === "production";
  if (!env.RESEND_API_KEY) {
    if (isProduction) return async () => { throw new Error("RESEND_API_KEY is not set"); };
    return async (email) => {
      console.log(`[email] to=${email.to} subject="${email.subject}"\n${email.text}`);
    };
  }

  return async (email) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.replyTo && { reply_to: email.replyTo }),
      }),
    });
    // The body explains the failure (e.g. unverified domain); it goes to the log only.
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  };
}

// Escapes user-provided text (names, messages) before it goes into an HTML email.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
