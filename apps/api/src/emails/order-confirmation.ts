import { formatAud, type OrderLine } from "@novap/shared";
import type { ShippingAddress } from "../db/schema";
import { escapeHtml, type Email } from "../lib/email";
import { layout } from "./layout";

export type OrderConfirmationData = {
  orderId: number;
  email: string;
  items: OrderLine[];
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  totalCents: number;
  shippingAddress: ShippingAddress | null;
};

const addressLines = (a: ShippingAddress) =>
  [a.name, a.line1, a.line2, `${a.city} ${a.state} ${a.postcode}`, a.country].filter(Boolean) as string[];

export function orderConfirmationEmail(order: OrderConfirmationData): Email {
  const subject = `Order #${order.orderId} confirmed`;
  const totals: [string, number][] = [
    ["Subtotal", order.subtotalCents],
    ["Shipping", order.shippingCents],
    ["Total", order.totalCents],
  ];
  const gstNote = `Includes GST of ${formatAud(order.gstCents)}`;
  const address = order.shippingAddress ? addressLines(order.shippingAddress) : [];

  const text = [
    `Thanks for your order. We've received your payment for order #${order.orderId}.`,
    "",
    ...order.items.map((i) => `${i.quantity} x ${i.productName} (${i.variantLabel}) — ${formatAud(i.unitPriceCents * i.quantity)}`),
    "",
    ...totals.map(([label, cents]) => `${label}: ${formatAud(cents)}`),
    gstNote,
    ...(address.length ? ["", "Shipping to:", ...address] : []),
  ].join("\n");

  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:6px 0;">${i.quantity} × ${escapeHtml(i.productName)} <span style="color:#78716c;">(${escapeHtml(i.variantLabel)})</span></td>
        <td style="padding:6px 0;text-align:right;">${formatAud(i.unitPriceCents * i.quantity)}</td>
      </tr>`,
    )
    .join("");
  const totalRows = totals
    .map(
      ([label, cents]) => `<tr>
        <td style="padding:4px 0;${label === "Total" ? "font-weight:bold;" : ""}">${label}</td>
        <td style="padding:4px 0;text-align:right;${label === "Total" ? "font-weight:bold;" : ""}">${formatAud(cents)}</td>
      </tr>`,
    )
    .join("");

  const html = layout(
    subject,
    `<h1 style="font-size:18px;margin:0 0 8px;">Thanks for your order</h1>
    <p style="margin:0 0 24px;">We've received your payment for order <strong>#${order.orderId}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;border-bottom:1px solid #e7e5e4;">${rows}</table>
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">${totalRows}</table>
    <p style="margin:4px 0 24px;color:#78716c;font-size:13px;">${gstNote}</p>
    ${address.length ? `<p style="margin:0 0 4px;font-weight:bold;">Shipping to</p><p style="margin:0;">${address.map(escapeHtml).join("<br>")}</p>` : ""}`,
  );

  return { to: order.email, subject, text, html };
}
