// Facet <-> URL translation for filter links.
//
// The URL convention comes from spec/menu.yaml: `?facet=handle1,handle2` —
// different keys AND together, comma-separated values OR together, exactly the
// Storefront filter engine's semantics. Handles are ours and portable across
// stores; the Storefront engine wants metaobject GIDs, so translation runs
// through the vocabulary fetched by GetFacetEntries (query.graphql).

import type {GetFacetEntriesQuery, ProductFilter} from "@/graphql/generated/graphql";

/** facet key -> handle -> gid. */
export type FacetVocab = Record<string, Record<string, string>>;

/** Facets whose values are metaobject handles (everything in the vocabulary).
 * `purity` is plain text and `tag`/`product_type` are literals — no lookup. */
const METAOBJECT_FACETS = ["design", "style", "finish", "material", "metal_colour", "size"] as const;

export function buildVocab(data: GetFacetEntriesQuery): FacetVocab {
  const vocab: FacetVocab = {};
  for (const facet of METAOBJECT_FACETS) {
    vocab[facet] = Object.fromEntries(data[facet].nodes.map((n) => [n.handle, n.id]));
  }
  return vocab;
}

const metafieldFilter = (key: string, value: string): ProductFilter => ({
  productMetafield: {namespace: "custom", key, value},
});

/**
 * `?design=pendant,choker&style=dainty` -> ProductFilter[]. Unknown facets and
 * unresolvable handles are dropped silently — a stale link should degrade to a
 * broader page, not an error.
 */
export function parseFilterParams(
  params: Record<string, string | string[] | undefined>,
  vocab: FacetVocab,
): ProductFilter[] {
  const filters: ProductFilter[] = [];
  for (const [facet, raw] of Object.entries(params)) {
    if (raw == null) continue;
    const values = (Array.isArray(raw) ? raw : [raw]).flatMap((v) => v.split(",")).filter(Boolean);
    for (const value of values) {
      if (facet === "tag") filters.push({tag: value});
      else if (facet === "product_type") filters.push({productType: value});
      else if (facet === "purity") filters.push(metafieldFilter("purity", value));
      else if (vocab[facet]) {
        const gid = vocab[facet][value];
        if (gid) filters.push(metafieldFilter(facet, gid));
      }
    }
  }
  return filters;
}

/** The reverse: active filters -> the canonical query string ("" when none). */
export function filtersToSearch(filters: ProductFilter[], vocab: FacetVocab): string {
  const handleOf: Record<string, string> = {};
  for (const entries of Object.values(vocab)) {
    for (const [handle, gid] of Object.entries(entries)) handleOf[gid] = handle;
  }

  const byFacet = new Map<string, string[]>();
  const add = (facet: string, value: string) => {
    byFacet.set(facet, [...(byFacet.get(facet) ?? []), value]);
  };

  for (const f of filters) {
    if (f.tag) add("tag", f.tag);
    else if (f.productType) add("product_type", f.productType);
    else if (f.productMetafield) {
      const {key, value} = f.productMetafield;
      add(key, handleOf[value] ?? value);
    }
    // Other filter shapes (availability, price) are UI state, not link state.
  }

  const params = [...byFacet.entries()]
    .map(([facet, values]) => `${encodeURIComponent(facet)}=${values.map(encodeURIComponent).join(",")}`)
    .join("&");
  return params ? `?${params}` : "";
}

/** Structural equality for the filter shapes we round-trip. */
export function filterEquals(a: ProductFilter, b: ProductFilter): boolean {
  if (a.productMetafield && b.productMetafield) {
    return (
      a.productMetafield.namespace === b.productMetafield.namespace &&
      a.productMetafield.key === b.productMetafield.key &&
      a.productMetafield.value === b.productMetafield.value
    );
  }
  if (a.tag != null || b.tag != null) return a.tag === b.tag;
  if (a.productType != null || b.productType != null) return a.productType === b.productType;
  return JSON.stringify(a) === JSON.stringify(b);
}
