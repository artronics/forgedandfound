# Shopify Migration

Design for the idempotent, reversible migration that provisions the data model in
[MODEL.md](./MODEL.md) into a Shopify store. Lives in `model/shopify`.

> **Greenfield.** Destructive operations are *allowed* (the store carries little and can
> be wiped), but still **gated** — nothing destructive runs without an explicit flag, and
> the live store needs an extra confirmation. Good hygiene is cheap insurance.

---

## 1. Architecture — desired-state reconciler

Terraform-shaped, matching how the team already thinks:

```
spec (desired)  ──▶  snapshot live  ──▶  diff / plan  ──▶  dry-run  ──▶  apply  ──▶  snapshot after
                        before.json      classify ops     (default)    (--apply)     after.json + changes.jsonl
```

The **spec** is the single source of truth (declarative TS in `model/shopify`) describing
desired metaobject and metafield definitions and their references. The reconciler fetches
live state, diffs, and converges — creating what's missing, updating what's drifted,
skipping what matches. It never assumes a clean store; every op re-checks live state, so
re-runs are no-ops.

---

## 2. Configuration

Store identity is hardcoded; credentials come from env / AWS Secrets Manager.

```ts
const config = {
  stores: [
    { name: "forged-and-found-dev",  type: "dev"  },
    { name: "forged-and-found-live", type: "live" },
  ],
};
```

- `accountPrefix` is intentionally **removed** — with no prefixes in the schema (MODEL.md
  §2), it has no job.
- Per-store credentials: dev uses the existing `SHOPIFY_ADMIN_CLIENT_ID` /
  `SHOPIFY_ADMIN_CLIENT_SECRET` / `NEXT_PUBLIC_SHOPIFY_STORE_NAME`. **Live credentials do
  not exist yet** — a `forged-and-found-live` app (its own client id/secret, ideally its
  own Secrets Manager entry) must exist before the live path runs.
- Logging via `@forgedandfound/logger` (`createLogger({ service: "shopify-migration" })`),
  pretty in dev.

---

## 3. Snapshots & data layout

Everything persists under `/Users/jalal/projects/forgedandfound/migration-data/<store-name>/<timestamp>/`
(outside the repo):

```
migration-data/forged-and-found-dev/2026-07-22T14-30-00Z/
  before.json     # full live state before apply (all definitions; entries in phase 2)
  plan.json       # the classified diff that was about to run
  after.json      # full live state after apply
  changes.jsonl   # one line per applied op: { op, resource, before, after, userErrors }
```

`before.json` is captured on **every** run (including dry-run) so there is always a
restore point.

---

## 4. Diff & operation classification

Each planned op is classified; the class controls whether it runs by default:

| Class | Operations | Default |
|---|---|---|
| **SAFE** | create definition; add *optional* field; change display `name`/`description`; add a choice; create/upsert metaobject entry | runs with `--apply` |
| **DESTRUCTIVE** | delete definition; delete a field; change `key`/`type`; make a field required; remove an in-use choice; prune stray resource | requires `--allow-destructive` (and `--confirm-live` on live) |

**Identity is immutable.** A metafield's `namespace`+`key` and a metaobject's `type`
cannot be renamed — only `name`/`description` can. A "rename" is therefore delete+recreate
(= data loss) and the reconciler **refuses** to auto-rename. A real rename is an explicit,
separate `create-new → copy-values → verify → retire-old` sequence, never part of a normal
apply.

---

## 5. Library + CLI

The engine is a **library** (`@forgedandfound/model-shopify`) with its own API; the
[`ff`](../../scripts/cli/README.md) CLI is the interface. The library never reads env or
credentials — the CLI resolves which store the Shopify env vars point at, guards it against
the requested `--store`, and hands the rest to the library. Shopify auth is env-var only
(the shared admin client), no AWS.

Library API (`model/shopify/index.ts`): `snapshot()`, `diff(current, spec, {prune})`,
`apply(current, plan, {allowDestructive, log})`, and `reconcile({storeName, baseDir, apply,
prune, allowDestructive, log})` which orchestrates + persists. `spec` and `stores`/`getStore`
are exported too.

```
ff shopify model plan  --store <dev|live> [--prune] [--out <dir>]
ff shopify model apply --store <dev|live> [--prune] [--allow-destructive] [--confirm-live] [--out <dir>]
```

| Command / flag | Effect |
|---|---|
| `plan` | **Dry-run** — snapshot + plan + print, no writes |
| `apply` | Execute the plan (SAFE ops; DESTRUCTIVE only with the flag below) |
| `--prune` | Include deletes of managed resources not in spec (clean-slate) — DESTRUCTIVE |
| `--allow-destructive` | Permit DESTRUCTIVE ops (delete/prune/required-field/type-change) |
| `--confirm-live` | Required to `apply` at all when `--store live` |
| `--out <dir>` | migration-data base dir; defaults to `MIGRATION_DATA_DIR` |

Defaults: `plan` is safe/read-only; `apply` is additive and dev-first. Live + destructive
needs the full flag set. The store guard refuses to run when the env store name does not
match `--store` (so `--store live` can never hit dev creds).

---

## 6. Apply order (dependency-ordered)

References must exist before referrers:

1. **Metaobject definitions** (`metaobjectDefinitionCreate/Update`) — `jewellery_material`,
   `jewellery_colour` before `jewellery_finish` (which references them); all before the
   metafields that reference them.
2. **Metafield definitions** (`metafieldDefinitionCreate/Update`) — product + (deferred)
   variant, with `metaobject_reference` validations pointing at the definitions from step 1.
3. **Metaobject entries** *(Phase 2)* — `metaobjectUpsert` by handle (natively idempotent).
4. **Product option ↔ finish wiring / product seeding** *(Phase 2)*.

Deletes run in reverse dependency order.

---

## 7. Idempotency & error handling

- **Idempotency by reconciliation.** Definitions are matched by identity
  (`ownerType`+`namespace`+`key`, or metaobject `type`); entries by `handle` via
  `metaobjectUpsert`. Create-if-absent, update-if-drifted, skip-if-equal.
- **`userErrors`, not just HTTP.** The Admin API returns `200 OK` with a `userErrors`
  array on logical failure. The current `shopifyAdminFetch` only checks `json.errors`
  ([client.ts:30](../../packages/shopify-admin-client/src/client.ts:30)) — the migration
  client must inspect `userErrors` on every mutation and fail the op (with the resource
  logged) if present.
- **Throttling.** Admin GraphQL is cost-throttled; back off and retry on 429 / throttled
  status. Apply sequentially within a dependency tier.
- **Partial failure.** Each op is independent and logged to `changes.jsonl` as it lands, so
  a mid-run failure leaves a precise record of what did/didn't apply; re-running converges
  the rest.

---

## 8. Rollback

Be honest about the limits:

- Rollback = re-apply a chosen `before.json` snapshot **as the spec**. This restores
  **structure** (recreates deleted definitions / metaobject definitions).
- It restores **values** only for metaobject entries captured in that snapshot (Phase 2).
- **Destroyed metafield values on products are not recoverable** — which is exactly why
  DESTRUCTIVE ops are gated. The guardrails are the real safety mechanism; rollback is the
  backstop, not a licence to delete casually.

---

## 9. Required changes to `packages/shopify-admin-client`

The client is currently **single-store** (module-level token cache, one store resolved
from env or the single secret `forgedandfound/infra/shopify` —
[auth.ts](../../packages/shopify-admin-client/src/auth.ts)). For a two-store migration:

1. **Multi-store factory** — `createAdminClient(store)` returning an instance with its own
   token cache and credentials, instead of the shared module singleton. Keep a thin default
   export so existing single-store callers are unaffected.
2. **New operations** — `metafieldDefinitionCreate/Update/Delete`,
   `metaobjectDefinitionCreate/Update/Delete`, `metaobjectUpsert`, plus read queries
   (`metafieldDefinitions`, `metaobjectDefinitions`) for snapshots.
3. **`userErrors` handling** in the shared fetch (or a migration-specific wrapper).

---

## 10. Phasing

| Phase | Scope | Status |
|---|---|---|
| **1** | Model + migration **design** (this doc + MODEL.md) | ✅ done |
| **2** | Spec + reconciler + CLI; run against **dev** (dry-run → apply → prune) | ✅ done — 18 defs live on dev |
| **3** | Metaobject **entries** (`seed-entries` from `vocabulary.json`) + product seeding | 🟡 seeder built; blocked on app scopes (below) |
| **4** | Promote to **live** with `--confirm-live` | ⛔ live app scopes not yet set |

### App access scopes (blocker for entries)

Definitions need `read/write_metaobject_definitions` (the dev app has these). **Entries**
(`seed-entries`) additionally need `read_metaobjects` + `write_metaobjects` — added to
`apps/shopify/shopify.app.forgedandfound-dev.toml`, but they must be **deployed and granted**
on the store (`shopify app deploy` + re-authorise) before `seed-entries` succeeds; until then
it fails fast with `ACCESS_DENIED`. The **live** app config
(`shopify.app.forgedandfound.toml`) currently declares only `read/write_customers` — it needs
the full product + metaobject scope set before any Phase-2/3/4 run against live.

---

## 11. Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Rename of key/type silently destroys values | High | Identity immutable; reconciler refuses auto-rename; explicit copy-migrate-retire only |
| `userErrors` ignored → op appears to succeed but no-ops | High | Inspect `userErrors` per mutation |
| `--prune` on the wrong store wipes definitions | High | Dry-run default; `--confirm-live`; snapshot before every run |
| Required-field / type-change breaks existing entries | Medium | Classified DESTRUCTIVE; add fields optional-only |
| Admin API cost throttling on bulk apply | Medium | Backoff/retry on 429; sequential within tiers |
| Live credentials absent | Medium | Provision `forged-and-found-live` app + secret before Phase 4 |
| Metaobject/metafield lacks storefront access → invisible to headless | Medium | Set storefront access on every definition (MODEL.md §4–5) |
