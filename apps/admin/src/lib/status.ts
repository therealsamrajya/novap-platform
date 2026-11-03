import type { ContactStatus, OrderStatus } from "@novap/shared";

type Color = "green" | "amber" | "blue" | "red" | "gray";

export const orderStatus: Record<OrderStatus, { label: string; color: Color }> = {
  pending: { label: "Awaiting payment", color: "gray" },
  paid: { label: "Paid, to ship", color: "amber" },
  fulfilled: { label: "Shipped", color: "green" },
  cancelled: { label: "Cancelled", color: "gray" },
  refunded: { label: "Refunded", color: "red" },
};

export const contactStatus: Record<ContactStatus, { label: string; color: Color }> = {
  new: { label: "New", color: "blue" },
  read: { label: "Read", color: "gray" },
  archived: { label: "Archived", color: "gray" },
};
