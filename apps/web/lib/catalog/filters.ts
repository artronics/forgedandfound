// The catalog filter domain boundary (collection + search).
//
// Storefront filters come entirely from Search & Discovery configuration: which
// facets exist, their order, and their labels (the metafield definition names —
// Design, Material, Metal Colour, Style, …). The frontend renders whatever the
// API returns rather than whitelisting labels, so enabling a facet in S&D is
// the *only* step needed to surface it here.

import type {ProductFilter} from "@/graphql/generated/graphql";

/** The structural shape both the collection and search queries return. */
export interface SourceFilter {
  id: string;
  label: string;
  type: string;
  values: {
    id: string;
    label: string;
    count: number;
    /** JSON-encoded ProductFilter — exactly what the query's `filters` wants. */
    input: string;
  }[];
}

export interface FilterValue {
  id: string;
  label: string;
  count: number;
  input: ProductFilter;
}

export interface FilterGroup {
  id: string;
  label: string;
  values: FilterValue[];
}

/**
 * Metaobject-backed value ids carry a gid; shorten it to a b64 token so query
 * params/DOM ids don't leak raw Shopify gids. Non-metaobject values (product
 * type, availability) have no gid — their id is already stable, keep it.
 */
export function extractId(s: string): string {
  const sub = "gid-shopify-";
  const at = s.indexOf(sub);
  if (at === -1) return s;
  return Buffer.from(s.substring(at + sub.length), "binary").toString("base64");
}

/** Every LIST filter the API returned, in S&D order, empty groups dropped.
 * (PRICE_RANGE/BOOLEAN need their own UI — not rendered yet.) */
export function convertFilters(filters?: SourceFilter[] | null): FilterGroup[] {
  return (filters ?? [])
    .filter((f) => f.type === "LIST" && f.values.length > 0)
    .map((f) => ({
      id: f.id,
      label: f.label,
      values: f.values.map((v) => ({
        id: extractId(v.id),
        label: v.label,
        count: v.count,
        input: JSON.parse(v.input) as ProductFilter,
      })),
    }));
}
