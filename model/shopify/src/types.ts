// Model types (the desired state, loaded from spec/*.yaml) + plan types (the
// computed diff).
//
// The spec types are generic over `TRef` — the union of metaobject types a `ref`
// may point at. TS code that builds a spec in-process gets compile-time checking;
// the YAML loader enforces the same rule at load time (see spec.ts), so a ref to
// an undeclared metaobject fails fast rather than at Shopify.

export type OwnerType = "PRODUCT" | "PRODUCTVARIANT" | "COLLECTION";

/** Free-form documentation carried through the loader but not consumed yet
 * (the hook for doc-as-code). Never sent to Shopify. */
export type SpecMeta = Record<string, unknown>;

/** Shopify field types this model uses. */
export type FieldType =
  | "single_line_text_field"
  | "multi_line_text_field"
  | "list.single_line_text_field"
  | "color"
  | "file_reference"
  | "number_integer"
  | "number_decimal"
  | "metaobject_reference"
  | "list.metaobject_reference";

/** Types whose value is a metaobject reference — these require `ref`. */
export const REFERENCE_TYPES = ["metaobject_reference", "list.metaobject_reference"] as const;

export function isReferenceType(type: string): boolean {
  return (REFERENCE_TYPES as readonly string[]).includes(type);
}

/** A field on a metaobject definition. */
export interface SpecField<TRef extends string = string> {
  key: string;
  name: string;
  type: FieldType;
  required?: boolean;
  /** Target metaobject type. Required for reference types, rejected otherwise. */
  ref?: TRef;
  /** Allowed values (single_line_text_field only) — renders a dropdown. */
  choices?: string[];
  /** Sent to Shopify as admin help text for the person entering data. */
  description?: string;
  meta?: SpecMeta;
}

export interface SpecMetaobject<TRef extends string = string> {
  type: string; // lowercase snake, e.g. "jewellery_finish"
  name: string; // display name
  fields: SpecField<TRef>[];
  /** Sent to Shopify; shown to whoever is entering data in the admin. */
  description?: string;
  meta?: SpecMeta;
}

export interface SpecMetafield<TRef extends string = string> {
  owner: OwnerType;
  key: string; // namespace is always "custom"
  name: string;
  type: FieldType;
  ref?: TRef;
  pin?: boolean;
  /** Sent to Shopify as admin help text. */
  description?: string;
  meta?: SpecMeta;
}

export interface Spec<TRef extends string = string> {
  metaobjects: SpecMetaobject<TRef>[];
  metafields: SpecMetafield<TRef>[];
}

/** Our category → Shopify Standard Product Taxonomy (spec/categories.yaml). */
export interface CategoryMapping {
  id: string;
  product_type: string;
  taxonomy_id: string;
  taxonomy_name: string;
}

// --- Collections + menus (spec/collections.yaml, spec/menu.yaml) ---

/** A facet → the handle(s) a product must carry. `category` resolves through
 * categories.yaml, `tag`/`product_type` are literal strings, everything else is
 * a `custom.<key>` metafield whose handle resolves to a metaobject GID. */
export type Conditions = Record<string, string | string[]>;

/**
 * One smart collection. Exactly one of `all`/`any` must be present — Shopify has
 * a single `appliedDisjunctively` flag per collection, so a rule set is entirely
 * AND or entirely OR and mixed logic is unrepresentable by construction.
 */
export interface SpecCollection {
  /** Identity *and* Shopify handle — /collections/<id>. */
  id: string;
  title: string;
  description?: string;
  /** Every condition must match (appliedDisjunctively: false). */
  all?: Conditions;
  /** Any condition may match (appliedDisjunctively: true). */
  any?: Conditions;
  meta?: SpecMeta;
}

/**
 * One navigation item. What it links to is inferred from which keys are present,
 * so there is no redundant `type`:
 *   `collection`            → a COLLECTION item
 *   `collection` + `filters`→ an HTTP filter link (query params)
 *   `url`                   → an explicit HTTP link
 *   none of them            → a heading (HTTP `#`), grouping its children
 */
export interface SpecMenuItem {
  title: string;
  /** An `id` from collections.yaml. */
  collection?: string;
  /** Extra facet conditions carried as query parameters. */
  filters?: Conditions;
  url?: string;
  items?: SpecMenuItem[];
}

export interface SpecMenu {
  handle: string;
  title: string;
  items: SpecMenuItem[];
}

// --- Plan types ---

export type OpClass = "SAFE" | "DESTRUCTIVE";

interface PlannedOpBase {
  class: OpClass;
  resource: string; // human id, e.g. "metaobject:jewellery_finish"
  reason: string;
}

export type PlannedOp = PlannedOpBase &
  (
    | {kind: "create-metaobject"; spec: SpecMetaobject}
    | {
        kind: "update-metaobject";
        id: string;
        type: string;
        name?: string;
        description?: string;
        addFields: SpecField[];
        updateFields: SpecField[];
        deleteFieldKeys: string[];
      }
    | {kind: "delete-metaobject"; id: string; type: string}
    | {kind: "create-metafield"; spec: SpecMetafield}
    | {kind: "update-metafield"; owner: OwnerType; key: string; name?: string; description?: string}
    | {kind: "delete-metafield"; id: string; owner: OwnerType; key: string}
  );

export type OpKind = PlannedOp["kind"];

export interface Plan {
  ops: PlannedOp[];
}

export interface ChangeRecord {
  op: OpKind;
  resource: string;
  class: OpClass;
  status: "applied" | "skipped" | "failed";
  error?: string;
}

export interface ApplyResult {
  changes: ChangeRecord[];
  failed: boolean;
}
