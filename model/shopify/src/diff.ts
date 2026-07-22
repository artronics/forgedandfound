import type {CurrentState} from "./snapshot.ts";
import type {OwnerType, Plan, PlannedOp, Spec} from "./types.ts";

// Pure diff: desired spec vs current state → a classified plan. No I/O, so this
// is the testable core. Classification drives whether an op runs by default
// (SAFE) or needs --allow-destructive (DESTRUCTIVE). Namespace/key/type are
// immutable identity, so a type change becomes delete+recreate, not an update.

export interface DiffOptions {
  /** Delete managed resources not present in the spec. */
  prune: boolean;
}

const moResource = (type: string) => `metaobject:${type}`;
const mfResource = (ownerType: string, key: string) => `metafield:${ownerType.toLowerCase()}/custom.${key}`;

/** Metaobject types we manage — everything except Shopify's reserved standards. */
const isManagedMetaobject = (type: string) => !type.startsWith("shopify--");

export function diff(current: CurrentState, spec: Spec, opts: DiffOptions): Plan {
  const ops: PlannedOp[] = [];

  // --- Metaobjects: create / update ---
  const currentMoByType = new Map(current.metaobjects.map((m) => [m.type, m]));
  for (const so of spec.metaobjects) {
    const co = currentMoByType.get(so.type);
    if (!co) {
      ops.push({kind: "create-metaobject", class: "SAFE", resource: moResource(so.type), reason: "absent", spec: so});
      continue;
    }
    const currentKeys = new Set(co.fieldDefinitions.map((f) => f.key));
    const specKeys = new Set(so.fields.map((f) => f.key));
    const addFields = so.fields.filter((f) => !currentKeys.has(f.key));
    const removeKeys = opts.prune ? co.fieldDefinitions.map((f) => f.key).filter((k) => !specKeys.has(k)) : [];
    const nameDrift = co.name !== so.name;

    if (addFields.length || removeKeys.length || nameDrift) {
      const reason = [
        nameDrift && "name",
        addFields.length && `+${addFields.length} field(s)`,
        removeKeys.length && `-${removeKeys.length} field(s)`,
      ]
        .filter(Boolean)
        .join(", ");
      ops.push({
        kind: "update-metaobject",
        class: removeKeys.length ? "DESTRUCTIVE" : "SAFE",
        resource: moResource(so.type),
        reason,
        id: co.id,
        type: so.type,
        name: nameDrift ? so.name : undefined,
        addFields,
        deleteFieldKeys: removeKeys,
      });
    }
  }

  // --- Metaobjects: prune (managed, present, not in spec) ---
  if (opts.prune) {
    const specTypes = new Set(spec.metaobjects.map((m) => m.type));
    for (const co of current.metaobjects) {
      if (!isManagedMetaobject(co.type) || specTypes.has(co.type)) continue;
      ops.push({
        kind: "delete-metaobject",
        class: "DESTRUCTIVE",
        resource: moResource(co.type),
        reason: "not in spec",
        id: co.id,
        type: co.type,
      });
    }
  }

  // --- Metafields: we manage only namespace "custom" ---
  const currentMf = current.metafields.filter((m) => m.namespace === "custom");
  const currentMfByKey = new Map(currentMf.map((m) => [`${m.ownerType}:${m.key}`, m]));
  for (const sm of spec.metafields) {
    const cm = currentMfByKey.get(`${sm.ownerType}:${sm.key}`);
    if (!cm) {
      ops.push({kind: "create-metafield", class: "SAFE", resource: mfResource(sm.ownerType, sm.key), reason: "absent", spec: sm});
      continue;
    }
    if (cm.type.name !== sm.type) {
      // Type is immutable → recreate.
      ops.push({
        kind: "delete-metafield",
        class: "DESTRUCTIVE",
        resource: mfResource(sm.ownerType, sm.key),
        reason: `type change ${cm.type.name}→${sm.type}`,
        id: cm.id,
        ownerType: sm.ownerType,
        key: sm.key,
      });
      ops.push({
        kind: "create-metafield",
        class: "DESTRUCTIVE",
        resource: mfResource(sm.ownerType, sm.key),
        reason: `recreate as ${sm.type}`,
        spec: sm,
      });
      continue;
    }
    if (cm.name !== sm.name) {
      ops.push({
        kind: "update-metafield",
        class: "SAFE",
        resource: mfResource(sm.ownerType, sm.key),
        reason: "name drift",
        ownerType: sm.ownerType,
        key: sm.key,
        name: sm.name,
      });
    }
  }

  // --- Metafields: prune (managed custom, present, not in spec) ---
  if (opts.prune) {
    const specKeys = new Set(spec.metafields.map((m) => `${m.ownerType}:${m.key}`));
    for (const cm of currentMf) {
      if (specKeys.has(`${cm.ownerType}:${cm.key}`)) continue;
      ops.push({
        kind: "delete-metafield",
        class: "DESTRUCTIVE",
        resource: mfResource(cm.ownerType, cm.key),
        reason: "not in spec",
        id: cm.id,
        ownerType: cm.ownerType as OwnerType,
        key: cm.key,
      });
    }
  }

  return {ops};
}
