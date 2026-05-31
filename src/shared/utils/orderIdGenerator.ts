// Chars chosen to avoid visual ambiguity (no 0/O, 1/I, L)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChars(length: number): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");
}

/** Generates a human-readable order ID: ORD-YYYYMMDD-XXXXXXX */
export function generateOrderID(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${date}-${randomChars(7)}`;
}

/** Generates a human-readable order item ID: ITM-XXXXXX */
export function generateItemID(): string {
  return `ITM-${randomChars(6)}`;
}
