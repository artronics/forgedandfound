import {getStore, reconcile, seedEntries, type StoreType} from "@forgedandfound/model-shopify";

import {shopify} from "../../env.ts";
import {info} from "../log.ts";

// `ff shopify model plan|apply` — drives the migration reconciler in
// @forgedandfound/model-shopify. The library is store-agnostic; here we resolve
// which store we're pointed at (from the same Shopify env vars the admin client
// uses), guard it against the requested --store, and pick where snapshots land.

export interface ModelOpts {
  store: string; // "dev" | "live"
  prune?: boolean;
  allowDestructive?: boolean;
  confirmLive?: boolean;
  out?: string;
}

function resolveStore(input: string) {
  if (input !== "dev" && input !== "live") {
    throw new Error(`--store must be 'dev' or 'live' (got '${input}')`);
  }
  const store = getStore(input as StoreType);
  // Guard: the env the admin client will authenticate with must be the store we
  // think we're targeting — so `--store live` can never run against dev creds.
  if (shopify.storeName !== store.name) {
    throw new Error(
      `Env store '${shopify.storeName}' does not match --store ${input} ('${store.name}'). ` +
        `Point NEXT_PUBLIC_SHOPIFY_STORE_NAME (+ admin creds) at ${store.name}, or choose the matching --store.`,
    );
  }
  return store;
}

function resolveBaseDir(out?: string): string {
  const dir = out ?? process.env.MIGRATION_DATA_DIR;
  if (!dir) {
    throw new Error(
      "No migration-data directory. Pass --out <dir> or set MIGRATION_DATA_DIR " +
        "(e.g. /Users/jalal/projects/forgedandfound/migration-data).",
    );
  }
  return dir;
}

async function run(opts: ModelOpts, apply: boolean): Promise<void> {
  const store = resolveStore(opts.store);
  const baseDir = resolveBaseDir(opts.out);

  if (apply && store.type === "live" && !opts.confirmLive) {
    throw new Error("Refusing to apply to the LIVE store without --confirm-live.");
  }

  const result = await reconcile({
    storeName: store.name,
    baseDir,
    apply,
    prune: !!opts.prune,
    allowDestructive: !!opts.allowDestructive,
    log: info, // human progress → stderr
  });

  console.log(result.runDir); // stdout: the run directory, one line, pipeable

  if (result.applied?.failed) {
    process.exitCode = 1;
  }
}

export function modelPlan(opts: ModelOpts): Promise<void> {
  return run(opts, false);
}

export function modelApply(opts: ModelOpts): Promise<void> {
  return run(opts, true);
}

export interface SeedEntriesOpts {
  store: string;
  dryRun?: boolean;
}

/** `ff shopify model seed-entries` — populate the metaobject entries (values). */
export async function modelSeedEntries(opts: SeedEntriesOpts): Promise<void> {
  const store = resolveStore(opts.store);
  const apply = !opts.dryRun;

  if (apply && store.type === "live") {
    // Entries are idempotent upserts, but live is still guarded like definitions.
    throw new Error("Refusing to seed entries into the LIVE store. Run against dev, or add explicit live support.");
  }

  const result = await seedEntries({apply, log: info});

  const by = (s: string) => result.changes.filter((c) => c.status === s).length;
  info(
    `\n${result.failed ? "ABORTED" : apply ? "Done" : "Dry run"}. ` +
      `${apply ? `upserted=${by("applied")} failed=${by("failed")}` : `${by("skipped")} entr(ies) would be upserted`}`,
  );

  console.log(String(result.changes.filter((c) => c.status === "applied").length)); // stdout: count applied

  if (result.failed) {
    process.exitCode = 1;
  }
}
