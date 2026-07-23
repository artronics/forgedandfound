import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";

import {getCategory} from "@forgedandfound/model-shopify";
import {parse as parseYaml} from "yaml";
import {shopifyAdminFetch} from "@forgedandfound/shopify-admin-client/client";
import {listMetaobjectEntries, listMetaobjects} from "@forgedandfound/shopify-admin-client/metaobjects";

// Binds a scraped product to the model (MODEL.md §5): the metal axis becomes a
// single **Finish** option and sizes become a **Size** option, both *resolved*
// against the curated vocabularies. Nothing is invented — an unmatched or
// ambiguous source value produces a warning and an unlinked option value, never
// a new metaobject. (Deriving finishes is what previously created duplicate and
// impossible entries.)

/** Facets read straight off the product. material/metal_colour/purity/size are
 * deliberately absent — they are projections built from the resolved finishes
 * and sizes, not from the product-level classification. */
const FACET_BINDINGS = [
  {field: "design", type: "jewellery_design", key: "design", list: false},
  {field: "styles", type: "jewellery_style", key: "style", list: true},
  {field: "gemstones", type: "jewellery_gemstone", key: "gemstone", list: true},
  {field: "stone_shapes", type: "jewellery_stone_shape", key: "stone_shape", list: true},
  {field: "setting", type: "jewellery_setting", key: "setting", list: false},
  {field: "chain_type", type: "jewellery_chain_type", key: "chain_type", list: false},
] as const;

const PROJECTION_TYPES = ["jewellery_material", "jewellery_colour", "jewellery_size", "jewellery_finish"];

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

/** What one option value names. Rarely just one facet: "18ct Yellow Gold
 * Vermeil" is a purity, a colour and a material at once. */
export interface MetalFacets {
  material?: string;
  metal_colour?: string;
  purity?: string;
}

export interface ProductOption {
  name: string;
  position: number;
  /** The facet this option *varies*: size | metal_colour | material | purity. */
  axis?: string | null;
  values: string[];
  /** Option value → the facets it names, for metal axes. */
  canonical?: Record<string, MetalFacets>;
}

export interface ScrapedProduct extends ProductModel {
  site?: string;
  category: string;
  options: ProductOption[];
  variants: {options: string[]}[];
}

// Curated overrides for ambiguous third-party option values (see the YAML for why).
declare const __dirname: string | undefined;
const moduleDir =
  typeof __dirname !== "undefined" ? __dirname : dirname(new URL(import.meta.url).pathname);

type FinishAliases = Record<string, Record<string, string>>;

const finishAliases: FinishAliases =
  (parseYaml(readFileSync(join(moduleDir, "finish-aliases.yaml"), "utf8")) as {aliases?: FinishAliases})
    ?.aliases ?? {};

/** The curated finish handle for a source option value on a given site, if one exists. */
function aliasFor(site: string | undefined, value: string | undefined): string | undefined {
  if (!site || !value) return undefined;
  return finishAliases[site]?.[value];
}

const uniq = (xs: (string | null | undefined)[]): string[] =>
  [...new Set(xs.filter((x): x is string => !!x))];

// --- The curated catalogue ---------------------------------------------------

export interface FinishEntry {
  id: string;
  handle: string;
  label: string;
  material?: string;
  purity?: string;
  colour?: string;
}

export interface SizeEntry {
  id: string;
  handle: string;
  label: string;
  category?: string;
  uk?: string;
  us?: string;
  eu?: string;
  length_cm?: string;
  length_inches?: string;
}

export interface Catalogue {
  /** metaobject type → handle → GID, for the straight facet references. */
  handles: Map<string, Map<string, string>>;
  finishes: FinishEntry[];
  sizes: SizeEntry[];
}

export async function loadCatalogue(): Promise<Catalogue> {
  const handles = new Map<string, Map<string, string>>();
  for (const type of [...FACET_BINDINGS.map((f) => f.type), ...PROJECTION_TYPES]) {
    const entries = await listMetaobjects(type);
    handles.set(type, new Map(entries.map((e) => [e.handle, e.id])));
  }

  const finishes = (await listMetaobjectEntries("jewellery_finish")).map((e) => ({
    id: e.id,
    handle: e.handle,
    label: e.fields.label ?? e.handle,
    material: e.fields.material,
    purity: e.fields.purity,
    colour: e.fields.colour,
  }));

  const sizes = (await listMetaobjectEntries("jewellery_size")).map((e) => ({
    id: e.id,
    handle: e.handle,
    label: e.fields.label ?? e.handle,
    category: e.fields.category,
    uk: e.fields.uk,
    us: e.fields.us,
    eu: e.fields.eu,
    length_cm: e.fields.length_cm,
    length_inches: e.fields.length_inches,
  }));

  return {handles, finishes, sizes};
}

// --- Resolution --------------------------------------------------------------

export interface FinishKey {
  material: string | null;
  purity: string | null;
  colour: string | null;
}

/** A variant's metal facets: whatever its own option values name, laid over the
 * product-level classification for everything they don't.
 *
 * The overlay is per *facet*, not per axis, because one option value names more
 * than one: Aurée's "Type of Gold" chooses between 9ct and 18ct, so the purity
 * has to come from the value even though nothing about the option is called
 * purity. Taking only the axis's own facet left both variants on the product's
 * 9ct and collapsed them into one. */
function variantFinishKey(
  p: ProductModel,
  options: ProductOption[],
  variantOptions: string[],
): FinishKey {
  let material = p.material ?? null;
  let colour = p.metal_colour ?? null;
  let purity = p.purity ?? null;
  options.forEach((o, i) => {
    const facets = variantOptions[i] == null ? undefined : o.canonical?.[variantOptions[i]];
    if (!facets) return;
    material = facets.material ?? material;
    colour = facets.metal_colour ?? colour;
    purity = facets.purity ?? purity;
  });
  return {material, purity, colour};
}

const describeKey = (k: FinishKey) =>
  [k.material, k.purity, k.colour].filter(Boolean).join(" + ") || "(nothing known)";

/**
 * Match a finish key against the curated finishes: every *known* facet must
 * agree. Exactly one candidate resolves; zero or several is reported rather than
 * guessed, because guessing is how impossible finishes got created before.
 */
export function matchFinish(
  key: FinishKey,
  finishes: FinishEntry[],
): {entry?: FinishEntry; warning?: string} {
  if (!key.material && !key.colour && !key.purity) return {};
  // An unset facet is a wildcard on *either* side: unknown on the source means
  // "no constraint", and unset on a curated finish means it is agnostic to that
  // facet (e.g. gold-plated-yellow carries no purity, so 18ct plating matches).
  const agrees = (a?: string | null, b?: string | null) => !a || !b || a === b;
  const candidates = finishes.filter(
    (f) => agrees(key.material, f.material) && agrees(key.colour, f.colour) && agrees(key.purity, f.purity),
  );
  if (candidates.length === 1) return {entry: candidates[0]};
  if (candidates.length === 0) {
    return {warning: `no curated finish matches ${describeKey(key)}`};
  }
  return {
    warning: `ambiguous finish for ${describeKey(key)} — candidates: ${candidates
      .map((c) => c.handle)
      .join(", ")}`,
  };
}

const norm = (s: string) => s.trim().toLowerCase();

/** Inches are a merchant's rounding of a centimetre length — 40cm is listed as
 * 16", not 15.7" — so an inch value matches the nearest curated length rather
 * than an exact one. Our lengths are 5cm (~2") apart, so three quarters of an
 * inch is generous enough to absorb the rounding and still unambiguous. */
const INCH_TOLERANCE = 0.75;

function nearestByInches(inches: number, inCategory: SizeEntry[]): SizeEntry | undefined {
  const nearest = inCategory
    .filter((s) => s.length_inches != null)
    .map((s) => ({size: s, gap: Math.abs(parseFloat(s.length_inches!) - inches)}))
    .sort((a, b) => a.gap - b.gap)[0];
  return nearest && nearest.gap <= INCH_TOLERANCE ? nearest.size : undefined;
}

/** Match a scraped size string ("N", "US 6 / UK L / EU 51", "45cm", `16"`) to a
 * curated size in the product's category. */
export function matchSize(value: string, category: string, sizes: SizeEntry[]): SizeEntry | undefined {
  const inCategory = sizes.filter((s) => s.category === category);
  const byField = (pick: (s: SizeEntry) => string | undefined, wanted: string) =>
    inCategory.find((s) => {
      const v = pick(s);
      return v != null && norm(v) === norm(wanted);
    });

  return (
    byField((s) => s.label, value) ??
    byField((s) => s.uk, value) ??
    byField((s) => s.us, value) ??
    byField((s) => s.eu, value) ??
    // "UK L" anywhere in a compound string.
    (value.match(/\buk\s*([a-z])\b/i)?.[1] !== undefined
      ? byField((s) => s.uk, value.match(/\buk\s*([a-z])\b/i)![1])
      : undefined) ??
    // A leading bare letter, e.g. "F / US 3".
    (value.match(/^\s*([a-z])\b/i)?.[1] !== undefined
      ? byField((s) => s.uk, value.match(/^\s*([a-z])\b/i)![1])
      : undefined) ??
    // A centimetre length, e.g. "45cm" / "45 cm" / "S/M - 18.5cm".
    (() => {
      const cm = value.match(/(\d+(?:\.\d+)?)\s*cm\b/i);
      if (!cm) return undefined;
      return inCategory.find(
        (s) => s.length_cm != null && parseFloat(s.length_cm) === parseFloat(cm[1]),
      );
    })() ??
    // An inch length, e.g. `16"` / `7.5 in`.
    (() => {
      const inches = value.match(/(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b)/i);
      return inches ? nearestByInches(parseFloat(inches[1]), inCategory) : undefined;
    })()
  );
}

// --- Binding a product -------------------------------------------------------

export interface MetafieldInput {
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface BuiltOption {
  name: string;
  values: string[];
}

export interface BoundVariant {
  optionValues: {optionName: string; name: string}[];
  finishGid: string | null;
  sizeGid: string | null;
}

export interface BoundProduct {
  options: BuiltOption[];
  variants: BoundVariant[];
  metafields: MetafieldInput[];
  warnings: string[];
}

const FINISH_OPTION = "Finish";
const SIZE_OPTION = "Size";

function handlesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
}

function refMetafield(
  key: string,
  type: string,
  gids: string[],
  list: boolean,
): MetafieldInput | null {
  if (!gids.length) return null;
  return {
    namespace: "custom",
    key,
    type: list ? "list.metaobject_reference" : "metaobject_reference",
    value: list ? JSON.stringify(gids) : gids[0],
  };
}

/**
 * Turn a scraped product into Shopify option/variant/metafield inputs.
 *
 * Axes follow the model: **Finish** (the metal composite), anything else, then
 * **Size** last. The scraper's separate colour/material axes collapse into
 * Finish; its size axis becomes Size with curated labels.
 */
export function bindProduct(product: ScrapedProduct, catalogue: Catalogue): BoundProduct {
  const warnings: string[] = [];
  const {handles, finishes, sizes} = catalogue;

  const metalAxes = product.options.filter((o) => o.axis === "material" || o.axis === "metal_colour");
  const sizeAxisIndex = product.options.findIndex((o) => o.axis === "size");
  const otherAxes = product.options
    .map((option, index) => ({option, index}))
    .filter(({option}) => option.axis !== "size" && option.axis !== "material" && option.axis !== "metal_colour");

  const hasFinishAxis = metalAxes.length > 0;
  const hasSizeAxis = sizeAxisIndex >= 0;

  const seenFinishWarnings = new Set<string>();
  const seenSizeWarnings = new Set<string>();

  const resolvedFinishes: FinishEntry[] = [];
  const resolvedSizes: SizeEntry[] = [];

  const variants: BoundVariant[] = product.variants.map((variant) => {
    const optionValues: {optionName: string; name: string}[] = [];

    // Finish. Resolved for *every* variant, axis or not: a product sold in one
    // constant finish still needs custom.finish — it just has no Finish option.
    let finishGid: string | null = null;

    // The source value for this variant's metal axis, when it has one. A curated
    // alias on it wins over facet matching, because it exists precisely where the
    // facets are unreliable or contradictory.
    const rawValue = hasFinishAxis
      ? metalAxes.map((o) => variant.options[product.options.indexOf(o)]).find((v) => v != null)
      : undefined;
    const aliasHandle = aliasFor(product.site, rawValue);
    const aliased = aliasHandle ? finishes.find((f) => f.handle === aliasHandle) : undefined;
    if (aliasHandle && !aliased) {
      const w = `finish alias '${aliasHandle}' for '${rawValue}' is not a curated finish`;
      if (!seenFinishWarnings.has(w)) {
        seenFinishWarnings.add(w);
        warnings.push(w);
      }
    }

    const key = variantFinishKey(product, product.options, variant.options);
    const {entry, warning} = aliased ? {entry: aliased, warning: undefined} : matchFinish(key, finishes);
    if (entry) {
      finishGid = entry.id;
      resolvedFinishes.push(entry);
    } else if (warning && !seenFinishWarnings.has(warning)) {
      seenFinishWarnings.add(warning);
      warnings.push(warning);
    }

    // The Finish *option* only exists where the metal actually varies.
    if (hasFinishAxis) {
      optionValues.push({optionName: FINISH_OPTION, name: entry?.label ?? rawValue ?? "Default"});
    }

    // Others, in source order
    for (const {option, index} of otherAxes) {
      const value = variant.options[index];
      if (value != null) optionValues.push({optionName: option.name, name: value});
    }

    // Size last
    let sizeGid: string | null = null;
    if (hasSizeAxis) {
      const raw = variant.options[sizeAxisIndex];
      const hit = raw == null ? undefined : matchSize(raw, product.category, sizes);
      if (hit) {
        sizeGid = hit.id;
        resolvedSizes.push(hit);
        optionValues.push({optionName: SIZE_OPTION, name: hit.label});
      } else {
        const warning = `no curated size matches '${raw}' for category '${product.category}'`;
        if (raw != null && !seenSizeWarnings.has(warning)) {
          seenSizeWarnings.add(warning);
          warnings.push(warning);
        }
        if (raw != null) optionValues.push({optionName: SIZE_OPTION, name: raw});
      }
    }

    return {optionValues, finishGid, sizeGid};
  });

  // Options carry the distinct values actually used, in first-seen order.
  const options: BuiltOption[] = [];
  const collect = (name: string) =>
    uniq(variants.flatMap((v) => v.optionValues.filter((o) => o.optionName === name).map((o) => o.name)));
  if (hasFinishAxis) options.push({name: FINISH_OPTION, values: collect(FINISH_OPTION)});
  for (const {option} of otherAxes) options.push({name: option.name, values: collect(option.name)});
  if (hasSizeAxis) options.push({name: SIZE_OPTION, values: collect(SIZE_OPTION)});

  // --- Metafields ---
  const metafields: MetafieldInput[] = [];
  const unresolved: string[] = [];

  for (const binding of FACET_BINDINGS) {
    const wanted = handlesOf(product[binding.field as keyof ProductModel]);
    if (!wanted.length) continue;
    const map = handles.get(binding.type)!;
    const gids: string[] = [];
    for (const h of wanted) {
      const gid = map.get(h);
      if (gid) gids.push(gid);
      else unresolved.push(`${binding.type}:${h}`);
    }
    const mf = refMetafield(binding.key, binding.type, gids, binding.list);
    if (mf) metafields.push(mf);
  }
  if (unresolved.length) warnings.push(`unresolved metaobject handles: ${uniq(unresolved).join(", ")}`);

  // Projections (MODEL.md §7): built from what actually resolved, falling back to
  // the product-level classification only when no finish resolved at all.
  const materials = uniq(resolvedFinishes.map((f) => f.material));
  const colours = uniq(resolvedFinishes.map((f) => f.colour));
  const purities = uniq(resolvedFinishes.map((f) => f.purity));
  const fallback = resolvedFinishes.length === 0;

  const materialGids = (fallback ? uniq([product.material]) : materials)
    .map((h) => handles.get("jewellery_material")!.get(h))
    .filter((g): g is string => !!g);
  const colourGids = (fallback ? uniq([product.metal_colour]) : colours)
    .map((h) => handles.get("jewellery_colour")!.get(h))
    .filter((g): g is string => !!g);
  const sizeGids = uniq(resolvedSizes.map((s) => s.handle))
    .map((h) => handles.get("jewellery_size")!.get(h))
    .filter((g): g is string => !!g);
  const purityValues = fallback ? uniq([product.purity]) : purities;

  const mMaterial = refMetafield("material", "jewellery_material", materialGids, true);
  if (mMaterial) metafields.push(mMaterial);
  const mColour = refMetafield("metal_colour", "jewellery_colour", colourGids, true);
  if (mColour) metafields.push(mColour);
  const mSize = refMetafield("size", "jewellery_size", sizeGids, true);
  if (mSize) metafields.push(mSize);
  const finishGids = uniq(resolvedFinishes.map((f) => f.handle))
    .map((h) => handles.get("jewellery_finish")!.get(h))
    .filter((g): g is string => !!g);
  const mFinish = refMetafield("finish", "jewellery_finish", finishGids, true);
  if (mFinish) metafields.push(mFinish);
  if (purityValues.length) {
    metafields.push({
      namespace: "custom",
      key: "purity",
      type: "list.single_line_text_field",
      value: JSON.stringify(purityValues),
    });
  }

  return {options, variants, metafields, warnings};
}

// --- Shopify standard taxonomy category --------------------------------------

const VERIFY_CATEGORIES = `
query VerifyCategories($ids: [ID!]!) {
  nodes(ids: $ids) { ... on TaxonomyCategory { id fullName isArchived } }
}`;

interface TaxonomyNode {
  id: string;
  fullName: string;
  isArchived: boolean;
}

/**
 * Our category id → Shopify taxonomy GID, from spec/categories.yaml.
 *
 * The ids are pinned rather than looked up by name, so we verify each still
 * resolves to the expected `fullName` and throw otherwise: a silently wrong
 * standard category would quietly corrupt Google/marketplace feeds.
 */
export async function resolveCategories(categoryIds: string[]): Promise<Map<string, string>> {
  const wanted = uniq(categoryIds).map((id) => ({id, mapping: getCategory(id)}));

  const unmapped = wanted.filter((w) => !w.mapping).map((w) => w.id);
  if (unmapped.length) {
    throw new Error(
      `No Shopify taxonomy mapping for category: ${unmapped.join(", ")} — add it to model/shopify/spec/categories.yaml`,
    );
  }

  const mappings = wanted.map((w) => w.mapping!);
  const data = await shopifyAdminFetch<{nodes: (TaxonomyNode | null)[]}>(VERIFY_CATEGORIES, {
    ids: mappings.map((m) => m.taxonomy_id),
  });
  const byId = new Map(data.nodes.filter((n): n is TaxonomyNode => !!n).map((n) => [n.id, n]));

  const resolved = new Map<string, string>();
  for (const m of mappings) {
    const node = byId.get(m.taxonomy_id);
    if (!node) {
      throw new Error(
        `Shopify taxonomy id ${m.taxonomy_id} (category '${m.id}') no longer resolves — update model/shopify/spec/categories.yaml`,
      );
    }
    if (node.fullName !== m.taxonomy_name) {
      throw new Error(
        `Shopify taxonomy ${m.taxonomy_id} is now "${node.fullName}", expected "${m.taxonomy_name}" — update model/shopify/spec/categories.yaml`,
      );
    }
    if (node.isArchived) {
      throw new Error(`Shopify taxonomy category ${m.taxonomy_id} ("${node.fullName}") is archived`);
    }
    resolved.set(m.id, m.taxonomy_id);
  }
  return resolved;
}
