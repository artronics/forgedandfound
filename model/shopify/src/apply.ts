import {
  createMetafieldDefinition,
  deleteMetafieldDefinition,
  updateMetafieldDefinition,
  type CreateMetafieldDefinitionInput,
  type MetafieldValidationInput,
} from "@forgedandfound/shopify-admin-client/metafields";
import {
  createMetaobjectDefinition,
  deleteMetaobjectDefinition,
  updateMetaobjectDefinition,
  type CreateMetaobjectDefinitionInput,
  type MetaobjectFieldDefinitionInput,
  type MetaobjectFieldOperationInput,
} from "@forgedandfound/shopify-admin-client/metaobjects";

import type {CurrentState} from "./snapshot.ts";
import type {ApplyResult, ChangeRecord, Plan, PlannedOp, SpecField, SpecMetafield, SpecMetaobject} from "./types.ts";

export interface ApplyOptions {
  allowDestructive: boolean;
  log?: (msg: string) => void;
}

/** Run the plan in dependency order: metaobjects (defs referenced by others)
 * before metafields; deletes after the things that reference them. Reference
 * validations are resolved to metaobject-definition GIDs just-in-time from a live
 * type→id map seeded from the snapshot and updated as new definitions are created. */
export async function apply(current: CurrentState, plan: Plan, opts: ApplyOptions): Promise<ApplyResult> {
  const log = opts.log ?? (() => {});
  const typeToGid = new Map(current.metaobjects.map((m) => [m.type, m.id]));
  const changes: ChangeRecord[] = [];

  const ordered = orderOps(plan.ops);

  for (const op of ordered) {
    if (op.class === "DESTRUCTIVE" && !opts.allowDestructive) {
      log(`SKIP  [DESTRUCTIVE] ${op.kind} ${op.resource} — ${op.reason} (needs --allow-destructive)`);
      changes.push({op: op.kind, resource: op.resource, class: op.class, status: "skipped"});
      continue;
    }
    try {
      await execute(op, typeToGid);
      log(`OK    [${op.class}] ${op.kind} ${op.resource} — ${op.reason}`);
      changes.push({op: op.kind, resource: op.resource, class: op.class, status: "applied"});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log(`FAIL  [${op.class}] ${op.kind} ${op.resource} — ${error}`);
      changes.push({op: op.kind, resource: op.resource, class: op.class, status: "failed", error});
      // Stop on first failure so a broken reference/schema doesn't cascade; the
      // partial record is returned and persisted by the caller.
      return {changes, failed: true};
    }
  }

  return {changes, failed: false};
}

/** Phase order: metaobject creates → metaobject updates → metafield deletes →
 * metafield creates → metafield updates → metaobject deletes. */
function orderOps(ops: PlannedOp[]): PlannedOp[] {
  const phase: Record<PlannedOp["kind"], number> = {
    "create-metaobject": 0,
    "update-metaobject": 1,
    "delete-metafield": 2,
    "create-metafield": 3,
    "update-metafield": 4,
    "delete-metaobject": 5,
  };
  // Stable sort preserves spec order within a phase (material before finish).
  return ops.map((op, i) => ({op, i})).sort((a, b) => phase[a.op.kind] - phase[b.op.kind] || a.i - b.i).map((x) => x.op);
}

async function execute(op: PlannedOp, typeToGid: Map<string, string>): Promise<void> {
  switch (op.kind) {
    case "create-metaobject": {
      const {id} = await createMetaobjectDefinition(metaobjectInput(op.spec, typeToGid));
      typeToGid.set(op.spec.type, id);
      return;
    }
    case "update-metaobject": {
      const fieldOps: MetaobjectFieldOperationInput[] = [
        ...op.addFields.map((f) => ({create: fieldInput(f, typeToGid)})),
        ...op.deleteFieldKeys.map((key) => ({delete: {key}})),
      ];
      await updateMetaobjectDefinition(op.id, {
        ...(op.name ? {name: op.name} : {}),
        ...(fieldOps.length ? {fieldDefinitions: fieldOps} : {}),
      });
      return;
    }
    case "delete-metaobject":
      await deleteMetaobjectDefinition(op.id);
      return;
    case "create-metafield":
      await createMetafieldDefinition(metafieldInput(op.spec, typeToGid));
      return;
    case "update-metafield":
      await updateMetafieldDefinition({
        namespace: "custom",
        key: op.key,
        ownerType: op.ownerType,
        ...(op.name ? {name: op.name} : {}),
        ...(op.description ? {description: op.description} : {}),
      });
      return;
    case "delete-metafield":
      // deleteAllAssociatedMetafields: on a destructive run we mean it.
      await deleteMetafieldDefinition(op.id, true);
      return;
  }
}

function refValidation(refType: string, typeToGid: Map<string, string>): MetafieldValidationInput {
  const gid = typeToGid.get(refType);
  if (!gid) {
    throw new Error(`Cannot resolve reference target '${refType}' — metaobject definition not found or not yet created`);
  }
  return {name: "metaobject_definition_id", value: gid};
}

function fieldInput(f: SpecField, typeToGid: Map<string, string>): MetaobjectFieldDefinitionInput {
  const validations: MetafieldValidationInput[] = [];
  if (f.refType) validations.push(refValidation(f.refType, typeToGid));
  if (f.choices) validations.push({name: "choices", value: JSON.stringify(f.choices)});
  return {
    key: f.key,
    name: f.name,
    type: f.type,
    required: f.required ?? false,
    ...(f.description ? {description: f.description} : {}),
    ...(validations.length ? {validations} : {}),
  };
}

function metaobjectInput(s: SpecMetaobject, typeToGid: Map<string, string>): CreateMetaobjectDefinitionInput {
  return {
    type: s.type,
    name: s.name,
    access: {storefront: "PUBLIC_READ"},
    capabilities: {publishable: {enabled: true}},
    fieldDefinitions: s.fields.map((f) => fieldInput(f, typeToGid)),
  };
}

function metafieldInput(s: SpecMetafield, typeToGid: Map<string, string>): CreateMetafieldDefinitionInput {
  const validations: MetafieldValidationInput[] = [];
  if (s.refType) validations.push(refValidation(s.refType, typeToGid));
  return {
    name: s.name,
    namespace: "custom",
    key: s.key,
    type: s.type,
    ownerType: s.ownerType,
    access: {storefront: "PUBLIC_READ"},
    pin: s.pin ?? false,
    ...(validations.length ? {validations} : {}),
  };
}
