import DOMPurify from "dompurify";
import {type ClassValue, clsx} from "clsx";
import {twMerge} from "tailwind-merge";
import {thumbHashToDataURL} from "thumbhash";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li", "h2", "h3"],
    ALLOWED_ATTR: [],
  });
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(word?: string | null) {
  if (!word) return "";
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export function unique<T>(a?: (T | null | undefined)[] | null): NonNullable<T>[] {
  if (!a) return [];
  return [...new Set(a.filter((i): i is NonNullable<T> => i != null))];
}

export function getThumbImage(thumbhash?: string | null) {
  try {
    return thumbHashToDataURL(base64ToUint8Array(thumbhash!));
  } catch {
    return "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  }
}

// Deduplicate based on key and KEEP the first seen
export function dedupeBy<T, K extends keyof T>(items: T[], key: K): T[] {
  const seen = new Set<T[K]>();

  return items.filter((item) => {
    const value = item[key];

    if (seen.has(value)) return false;
    seen.add(value);

    return true;
  });
}

/**
 * Creates runtime utilities for a union type derived from an ordered readonly tuple.
 *
 * Intended for cases where:
 * - the tuple is the runtime source of truth
 * - the union type is derived from that tuple
 * - values may include null / undefined / unknown strings
 * - invalid values should be removed before sorting
 *
 * Example:
 *   const JEWELLERY_COLOUR = ["Gold", "Rose", "White", "Silver"] as const;
 *   type JewelleryColour = typeof JEWELLERY_COLOUR[number];
 *
 *   const jewelleryColourUtils = createUnionKeySorter(JEWELLERY_COLOUR);
 *
 *   const sortedValues = jewelleryColourUtils.sortValues(["Silver", null, "Gold"]);
 *   const sortedItems = jewelleryColourUtils.sortBy(items, item => item.colour);
 */
export function createUnionKeySorter<const TOrder extends readonly string[]>(
  order: TOrder,
) {
  type TValue = TOrder[number];

  const allowed = new Set<string>(order);

  const rank = Object.fromEntries(
    order.map((value, index) => [value, index]),
  ) as Record<TValue, number>;

  /**
   * Runtime type guard for the union represented by `order`.
   */
  function isAllowed(value: string | null | undefined): value is TValue {
    return typeof value === "string" && allowed.has(value);
  }

  /**
   * Removes null / undefined / unknown values and sorts the remaining union values
   * according to the order definition.
   */
  function sortValues(values: readonly (string | null | undefined)[]): TValue[] {
    return values
      .filter(isAllowed)
      .sort((a, b) => rank[a] - rank[b]);
  }

  /**
   * Removes items whose selected key is null / undefined / unknown, then sorts
   * the remaining items by that key.
   */
  function sortBy<TItem>(
    items: readonly TItem[],
    getValue: (item: TItem) => string | null | undefined,
  ): TItem[] {
    return items
      .filter((item) => isAllowed(getValue(item)))
      .sort((a, b) => {
        const aValue = getValue(a);
        const bValue = getValue(b);

        return rank[aValue as TValue] - rank[bValue as TValue];
      });
  }

  return {
    order,
    isAllowed,
    sortValues,
    sortBy,
  };
}

export function removeDuplicateWords(input: string): string {
  const seen = new Set<string>();

  return input
    .split(/\s+/)
    .filter(word => {
      const key = word.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .join(" ");
}

export const norm = (s: string) => s.toLowerCase().trim();
