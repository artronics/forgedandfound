// Declarative model types (the desired state) + plan types (the computed diff).

export type OwnerType = "PRODUCT" | "PRODUCTVARIANT" | "COLLECTION";

/** A field on a metaobject definition. */
export interface SpecField {
  key: string;
  name: string;
  type: string; // Shopify field type, e.g. "single_line_text_field", "color"
  required?: boolean;
  /** For *reference types: the target metaobject `type` this field points at. */
  refType?: string;
  /** For single_line_text_field: the allowed values (renders a dropdown). */
  choices?: string[];
  description?: string;
}

export interface SpecMetaobject {
  type: string; // lowercase snake, e.g. "jewellery_finish"
  name: string; // display name
  fields: SpecField[];
}

export interface SpecMetafield {
  ownerType: OwnerType;
  key: string; // namespace is always "custom"
  name: string;
  type: string; // e.g. "metaobject_reference", "list.metaobject_reference"
  /** For *reference types: the target metaobject `type`. */
  refType?: string;
  description?: string;
  pin?: boolean;
}

export interface Spec {
  metaobjects: SpecMetaobject[];
  metafields: SpecMetafield[];
}

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
        addFields: SpecField[];
        deleteFieldKeys: string[];
      }
    | {kind: "delete-metaobject"; id: string; type: string}
    | {kind: "create-metafield"; spec: SpecMetafield}
    | {kind: "update-metafield"; ownerType: OwnerType; key: string; name?: string; description?: string}
    | {kind: "delete-metafield"; id: string; ownerType: OwnerType; key: string}
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
