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
