const STORAGE_KEY = "cart-max-quantities";

function readStore(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getMaxQuantity(lineId?: string): number | null {
  if (!lineId) return null;
  return readStore()[lineId] ?? null;
}

export function setMaxQuantity(lineId: string, quantity: number) {
  const store = readStore();
  store[lineId] = quantity;
  writeStore(store);
}

export function removeMaxQuantity(lineId: string) {
  const store = readStore();
  delete store[lineId];
  writeStore(store);
}