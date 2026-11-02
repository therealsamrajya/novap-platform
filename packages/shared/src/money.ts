// Money is always stored as integer cents (AUD) to avoid floating point errors.
// $49.95 -> 4995. Only convert to dollars for display.

export const CURRENCY = "aud" as const;

// Australian GST is 10% and retail prices are shown GST-inclusive,
// so the GST portion of an inclusive price is price / 11.
export const GST_RATE = 0.1;

export function gstFromInclusive(cents: number): number {
  return Math.round(cents / 11);
}

export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}
