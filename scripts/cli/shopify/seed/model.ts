import {listMetaobjects, upsertMetaobject} from "@forgedandfound/shopify-admin-client/metaobjects";

// Binds a scraped product (facet handles from the new model) to Shopify: resolve
// handles → metaobject GIDs, build the custom.* metafields, and compose the
// per-product `finish` metaobject. Handles are store-agnostic (the scraper emits
// them); GIDs are resolved here against the target store.

/** product.json facet field → (metaobject type, custom metafield key, is-list). */
export interface FacetBinding {
  field: keyof ProductModel;
  type: string;
  key: string;
  list: boolean;
}

export const PRODUCT_FACETS: FacetBinding[] = [
  {field: "design", type: "jewellery_design", key: "design", list: false},
  {field: "styles", type: "jewellery_style", key: "style", list: true},
  {field: "gemstones", type: "jewellery_gemstone", key: "gemstone", list: true},
  {field: "stone_shapes", type: "jewellery_stone_shape", key: "stone_shape", list: true},
  {field: "setting", type: "jewellery_setting", key: "setting", list: false},
  {field: "chain_type", type: "jewellery_chain_type", key: "chain_type", list: false},
  // Denormalised single value → one-element list, for collection filtering (MODEL.md §8).
  {field: "material", type: "jewellery_material", key: "material", list: true},
  {field: "metal_colour", type: "jewellery_colour", key: "metal_colour", list: true},
];

const NEEDED_TYPES = [...new Set(PRODUCT_FACETS.map((f) => f.type))];

export interface ProductModel {
  design?: string | null;
  styles?: string[];
  gemstones?: string[];
  stone_shapes?: string[];
  setting?: string | null;
  chain_type?: string | null;
  material?: string | null;
  metal_colour?: string | null;
  purity?: string | null;
}

export type HandleMaps = Map<string, Map<string, string>>;

/** One handle → GID map per metaobject type we reference. */
export async function loadHandleMaps(): Promise<HandleMaps> {
  const maps: HandleMaps = new Map();
  for (const type of NEEDED_TYPES) {
    const entries = await listMetaobjects(type);
    maps.set(type, new Map(entries.map((e) => [e.handle, e.id])));
  }
  return maps;
}

export interface MetafieldInput {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

function handlesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
}

/** Product-level custom.* metafields (metaobject refs + denormalised purity list).
 * Unresolvable handles are collected (not silently dropped) so the caller can warn. */
export function buildProductMetafields(
  p: ProductModel,
  maps: HandleMaps,
): {metafields: MetafieldInput[]; unresolved: string[]} {
  const metafields: MetafieldInput[] = [];
  const unresolved: string[] = [];

  for (const f of PRODUCT_FACETS) {
    const handles = handlesOf(p[f.field]);
    if (!handles.length) continue;
    const map = maps.get(f.type)!;
    const gids: string[] = [];
    for (const h of handles) {
      const gid = map.get(h);
      if (gid) gids.push(gid);
      else unresolved.push(`${f.type}:${h}`);
    }
    if (!gids.length) continue;
    metafields.push({
      namespace: "custom",
      key: f.key,
      type: f.list ? "list.metaobject_reference" : "metaobject_reference",
      value: f.list ? JSON.stringify(gids) : gids[0],
    });
  }

  if (p.purity) {
    metafields.push({
      namespace: "custom",
      key: "purity",
      type: "list.single_line_text_field",
      value: JSON.stringify([p.purity]),
    });
  }

  return {metafields, unresolved};
}

const titleCase = (handle: string) =>
  handle
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

/** Deterministic finish handle from material[-purity][-colour], or null (no material). */
export function finishHandleFor(p: ProductModel): string | null {
  if (!p.material) return null;
  return [p.material, p.purity, p.metal_colour].filter(Boolean).join("-");
}

function finishLabel(p: ProductModel): string {
  return [p.purity, p.metal_colour && titleCase(p.metal_colour), p.material && titleCase(p.material)]
    .filter(Boolean)
    .join(" ");
}

/** Idempotently upsert the product's composite finish; returns its GID (null if no
 * resolvable material — `jewellery_finish.material` is required). */
export async function ensureFinish(p: ProductModel, maps: HandleMaps): Promise<string | null> {
  const handle = finishHandleFor(p);
  if (!handle || !p.material) return null;
  const materialGid = maps.get("jewellery_material")!.get(p.material);
  if (!materialGid) return null;
  const colourGid = p.metal_colour ? maps.get("jewellery_colour")!.get(p.metal_colour) : null;

  const fields: {key: string; value: string}[] = [
    {key: "label", value: finishLabel(p)},
    {key: "material", value: materialGid},
  ];
  if (p.purity) fields.push({key: "purity", value: p.purity});
  if (colourGid) fields.push({key: "colour", value: colourGid});

  const {id} = await upsertMetaobject("jewellery_finish", handle, {
    fields,
    capabilities: {publishable: {status: "ACTIVE"}},
  });
  return id;
}
