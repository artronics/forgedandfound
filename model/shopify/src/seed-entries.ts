import {upsertMetaobject} from "@forgedandfound/shopify-admin-client/metaobjects";

import {spec} from "./spec.ts";
import {vocabulary} from "./vocabulary.ts";

// Phase 3: populate metaobject *entries* (the values) from the model-owned
// vocabulary. Upsert-by-handle is natively idempotent, so re-runs are no-ops.
// Reference fields (finish.material / finish.colour) hold a handle in the
// vocabulary; here they resolve to the referenced entry's GID — which is why the
// vocabulary is ordered so referenced types (material, colour) seed first.

export interface SeedEntriesOptions {
  /** false = dry-run: print intended upserts, call nothing. */
  apply: boolean;
  log?: (msg: string) => void;
}

export interface EntryChange {
  resource: string;
  status: "applied" | "skipped" | "failed";
  error?: string;
}

export interface SeedEntriesResult {
  changes: EntryChange[];
  failed: boolean;
}

/** type → (fieldKey → target metaobject type), from the spec's reference fields. */
function referenceFieldMap(): Map<string, Map<string, string>> {
  const byType = new Map<string, Map<string, string>>();
  for (const mo of spec.metaobjects) {
    const refs = new Map<string, string>();
    for (const f of mo.fields) if (f.refType) refs.set(f.key, f.refType);
    byType.set(mo.type, refs);
  }
  return byType;
}

export async function seedEntries(opts: SeedEntriesOptions): Promise<SeedEntriesResult> {
  const log = opts.log ?? (() => {});
  const refFields = referenceFieldMap();
  const handleToId = new Map<string, Map<string, string>>(); // type → (handle → entry GID)
  const changes: EntryChange[] = [];

  for (const [type, entries] of Object.entries(vocabulary)) {
    const refs = refFields.get(type) ?? new Map<string, string>();
    const idsForType = new Map<string, string>();
    handleToId.set(type, idsForType);
    log(`\n${type} (${entries.length})`);

    for (const entry of entries) {
      const resource = `entry:${type}/${entry.handle}`;

      if (!opts.apply) {
        log(`  plan  ${resource}`);
        changes.push({resource, status: "skipped"});
        continue;
      }

      // Resolve fields: reference fields carry a handle → swap for the entry GID.
      const fields: {key: string; value: string}[] = [];
      let error: string | undefined;
      for (const [key, value] of Object.entries(entry.fields)) {
        const refType = refs.get(key);
        if (!refType) {
          fields.push({key, value});
          continue;
        }
        const gid = handleToId.get(refType)?.get(value);
        if (!gid) {
          error = `unresolved ${refType} reference '${value}' for field '${key}'`;
          break;
        }
        fields.push({key, value: gid});
      }

      if (error) {
        log(`  FAIL  ${resource} — ${error}`);
        changes.push({resource, status: "failed", error});
        return {changes, failed: true};
      }

      try {
        const {id} = await upsertMetaobject(type, entry.handle, {
          fields,
          capabilities: {publishable: {status: "ACTIVE"}},
        });
        idsForType.set(entry.handle, id);
        log(`  OK    ${resource}`);
        changes.push({resource, status: "applied"});
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`  FAIL  ${resource} — ${message}`);
        changes.push({resource, status: "failed", error: message});
        return {changes, failed: true};
      }
    }
  }

  return {changes, failed: false};
}
