import type { CartItem } from "@novap/shared";
import { useSyncExternalStore } from "react";

// The cart lives in localStorage, so it survives reloads and needs no account.
// It keeps only ids, quantities and the product slug (to look the product up again):
// names and prices are always read fresh from the API, and checkout re-reads prices anyway.
export type CartLine = CartItem & { slug: string };

const KEY = "novap.cart";
const MAX_QTY = 99; // checkoutSchema's limit per line

const listeners = new Set<() => void>();
let lines: CartLine[] = read();

function read(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    // Anything hand-edited or from an older version is dropped instead of breaking checkout.
    return parsed.filter(
      (l): l is CartLine =>
        Number.isInteger(l?.variantId) && Number.isInteger(l?.quantity) && l.quantity > 0 && typeof l?.slug === "string",
    );
  } catch {
    return [];
  }
}

function write(next: CartLine[]) {
  lines = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

// Another tab changed the cart: pick it up so the header count stays right.
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  lines = read();
  listeners.forEach((l) => l());
});

const clamp = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(n)));

export const cart = {
  // One line per variant (the API rejects duplicates), so adding again raises the quantity.
  add(line: CartLine) {
    const existing = lines.find((l) => l.variantId === line.variantId);
    write(
      existing
        ? lines.map((l) => (l === existing ? { ...l, quantity: clamp(l.quantity + line.quantity) } : l))
        : [...lines, { ...line, quantity: clamp(line.quantity) }],
    );
  },
  setQuantity(variantId: number, quantity: number) {
    write(lines.map((l) => (l.variantId === variantId ? { ...l, quantity: clamp(quantity) } : l)));
  },
  remove(variantId: number) {
    write(lines.filter((l) => l.variantId !== variantId));
  },
  clear() {
    write([]);
  },
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useCart = () => useSyncExternalStore(subscribe, () => lines);

export const useCartCount = () => useCart().reduce((n, l) => n + l.quantity, 0);
