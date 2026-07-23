// Shopify Admin mutations return HTTP 200 with a `userErrors` array on logical
// failure — `shopifyAdminFetch` only throws on transport / top-level `errors`,
// so callers that mutate MUST inspect `userErrors` themselves. This is the shared
// shape + a typed error the definition/metaobject ops raise when it is non-empty.

export interface UserError {
  field: string[] | null;
  message: string;
  code?: string | null;
}

export class ShopifyUserError extends Error {
  readonly userErrors: UserError[];

  constructor(operation: string, userErrors: UserError[]) {
    const detail = userErrors
      .map((e) => `${e.field?.join(".") ?? "-"}: ${e.message}${e.code ? ` (${e.code})` : ""}`)
      .join("; ");
    super(`${operation} failed: ${detail || "unknown userError"}`);
    this.name = "ShopifyUserError";
    this.userErrors = userErrors;
  }
}
