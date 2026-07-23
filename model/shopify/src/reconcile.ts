import {apply} from "./apply.ts";
import {diff} from "./diff.ts";
import {makeRunDir, timestamp, writeJson, writeJsonl} from "./persist.ts";
import {snapshot} from "./snapshot.ts";
import {spec} from "./spec.ts";
import type {ApplyResult, Plan} from "./types.ts";

export interface ReconcileOptions {
  storeName: string;
  baseDir: string;
  /** false = dry-run: snapshot + plan, no writes to Shopify. */
  apply: boolean;
  prune: boolean;
  allowDestructive: boolean;
  log?: (msg: string) => void;
}

export interface ReconcileResult {
  runDir: string;
  plan: Plan;
  applied?: ApplyResult;
}

/** Orchestrate snapshot → diff → (dry-run print | apply) → after-snapshot, and
 * persist every artifact. Never reads env or credentials — the caller wires the
 * store (the admin client resolves its own store from env). */
export async function reconcile(opts: ReconcileOptions): Promise<ReconcileResult> {
  const log = opts.log ?? (() => {});
  const runDir = makeRunDir(opts.baseDir, opts.storeName, timestamp());

  log(`Snapshotting ${opts.storeName} …`);
  const before = await snapshot();
  writeJson(runDir, "before.json", before);

  const plan = diff(before, spec, {prune: opts.prune});
  writeJson(runDir, "plan.json", plan);
  summarise(plan, opts, log);

  if (!opts.apply) {
    log(`\nDry run — no changes made. Snapshot + plan written to:\n  ${runDir}`);
    return {runDir, plan};
  }

  log(`\nApplying …`);
  const applied = await apply(before, plan, {allowDestructive: opts.allowDestructive, log});
  writeJsonl(runDir, "changes.jsonl", applied.changes);

  // Re-snapshot the resulting state (skip if the run aborted mid-way to avoid
  // masking the failure point; the before/changes are enough to diagnose).
  if (!applied.failed) {
    writeJson(runDir, "after.json", await snapshot());
  }

  const by = (s: string) => applied.changes.filter((c) => c.status === s).length;
  log(`\n${applied.failed ? "ABORTED" : "Done"}. applied=${by("applied")} skipped=${by("skipped")} failed=${by("failed")}`);
  log(`Artifacts:\n  ${runDir}`);
  return {runDir, plan, applied};
}

function summarise(plan: Plan, opts: ReconcileOptions, log: (m: string) => void): void {
  const safe = plan.ops.filter((o) => o.class === "SAFE");
  const destructive = plan.ops.filter((o) => o.class === "DESTRUCTIVE");
  log(`\nPlan: ${plan.ops.length} op(s) — ${safe.length} safe, ${destructive.length} destructive`);
  for (const op of plan.ops) {
    const gate = op.class === "DESTRUCTIVE" && !(opts.apply && opts.allowDestructive) ? " (blocked)" : "";
    log(`  ${op.class === "DESTRUCTIVE" ? "!" : "+"} ${op.kind} ${op.resource} — ${op.reason}${gate}`);
  }
}
