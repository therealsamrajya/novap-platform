// Admins type prices in dollars; the API wants integer cents.
// Parsed as text, not with parseFloat * 100, because 0.29 * 100 = 28.999999999999996.
export function dollarsToCents(input: string): number | null {
  const m = input.trim().replace(/[$,]/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export const centsToDollars = (cents: number) => (cents / 100).toFixed(2);
