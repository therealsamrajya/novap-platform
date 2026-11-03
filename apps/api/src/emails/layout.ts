import { escapeHtml } from "../lib/email";

// Minimal shared HTML shell for all emails. Inline styles only: most email clients
// strip <style> tags and ignore external CSS.
export function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;">
    <p style="margin:0 0 24px;font-size:20px;letter-spacing:4px;font-weight:bold;">NŌVAP</p>
    ${bodyHtml}
  </div>
</body>
</html>`;
}
