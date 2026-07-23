# ff

Development CLI for Forged & Found. Runs directly as TypeScript (no build step)
via [tsx](https://tsx.is) — the [`ff`](ff.mjs) launcher registers tsx's ESM+CJS
loaders, so the CLI can import workspace TypeScript packages like
`@forgedandfound/shopify-admin-client` (Node's own type-stripping refuses `.ts`
files under `node_modules`).

## Install

The root workspace depends on `@forgedandfound/scripts`, so a normal install
links the binary into the repo:

```
pnpm install
pnpm exec ff shopify get-admin-token     # from anywhere in the repo
```

For a bare `ff` on your PATH, either add `./node_modules/.bin` to PATH, or link
it globally from `scripts/` (needs pnpm's global bin dir on PATH — run
`pnpm setup` once if pnpm complains):

```
cd scripts && pnpm link --global
```

## Commands

```
ff shopify get-admin-token                                     # print the Shopify admin access token
ff shopify seed products -d ./data [options]                   # create products from scraped data
ff shopify seed products -d ./data -c ring --per-category 3    # a spread: 3 rings, or 3 of each category
ff shopify seed products -d ./data --delete [--limit N]        # delete what was seeded from that data
ff shopify model plan --store dev                              # dry-run the data-model migration (snapshot + plan)
ff shopify model apply --store dev [--prune]                   # provision the metaobject/metafield model
ff shopify model seed-entries --store dev [--dry-run]          # populate metaobject entries (the values)
ff aws cognito-delete-all                                      # delete up to 4 Cognito users (nonprod only)
```

### Model migration

`model plan|apply` drives the reconciler in
[`@forgedandfound/model-shopify`](../../../model/shopify) (spec in
[`MODEL.md`](../../../model/shopify/MODEL.md), design in
[`MIGRATION.md`](../../../model/shopify/MIGRATION.md)). It converges a store's
metaobject/metafield **definitions** to the declarative spec — idempotent (re-runs are
no-ops), additive by default, with snapshots + a change log written per run.

- `plan` is read-only: snapshots the store, prints the classified change plan, writes
  nothing to Shopify.
- `apply` executes it. SAFE ops (creates, name changes, added fields) run by default;
  DESTRUCTIVE ops (deletes, prune, key/type changes) need `--allow-destructive`, and any
  `apply` to `--store live` needs `--confirm-live`.
- `--prune` deletes managed resources (`custom.*` metafields and non-`shopify--` metaobjects)
  that aren't in the spec — the clean-slate path.
- Artifacts land under `--out <dir>` or `MIGRATION_DATA_DIR`
  (e.g. `/Users/jalal/projects/forgedandfound/migration-data`), as
  `<store>/<timestamp>/{before,plan,after}.json` + `changes.jsonl`. The run directory is
  printed to stdout.

A store guard refuses to run unless the Shopify env (`NEXT_PUBLIC_SHOPIFY_STORE_NAME`) matches
the requested `--store`, so `--store live` can never act on dev credentials. Uses the same
env-var auth as the other `shopify` commands — no AWS.

`seed-entries` populates the controlled-vocabulary values (materials, colours, designs,
styles, …, and a starter set of composite finishes) from the model-owned
[`vocabulary.json`](../../../model/shopify/vocabulary.json), via idempotent upsert-by-handle.
It needs the app's `read_metaobjects` + `write_metaobjects` access scopes (definitions only
need `*_metaobject_definitions`); grant those on the app before running.

### Seeding

`seed products` walks a scraped data directory (our `products/<category>/<design>/<id>/`
convention — pass the folder that *holds* `products/`, e.g. `-d ./data`) and creates each product
in Shopify via the Admin GraphQL `productSet` mutation (title/description/vendor from `meta.json`;
product type, `design:`/`style:` tags, options and variants from `product.json`). Shopify calls go
through the shared [`@forgedandfound/shopify-admin-client`](../../../packages/shopify-admin-client)
(`shopifyAdminFetch` / `getAdminAccessToken`), which authenticates from the app's **env vars**
(`NEXT_PUBLIC_SHOPIFY_STORE_NAME`, `SHOPIFY_ADMIN_CLIENT_ID`, `SHOPIFY_ADMIN_CLIENT_SECRET`,
`NEXT_PUBLIC_SHOPIFY_API_VERSION`) when present, and falls back to **AWS Secrets Manager** otherwise
(how the Lambdas run). Both `seed` and `get-admin-token` use this same path.

Options:

- `--limit N` — at most N products in total. **Spread across categories, not taken off the top**:
  the tree is sorted by path, so a flat slice of 8 would be 8 bracelets and no rings. Categories
  are taken one at a time in turn, so a small limit still shows you each.
- `--per-category N` — at most N from each category. `--per-category 3` is the quickest way to
  get a representative handful.
- `-c, --category <id...>` — only these categories (`ring`, `necklace`, `earring`, `bracelet`).
- `-s, --site <name...>` — only products scraped from these source sites.
- `--status draft|active` — product status (default `draft`).
- `--stock N` — inventory tracked and set to N available per variant (default `5`).
- `--with-photos [N]` — also upload images (by URL, from `meta.json`); optional `N` caps how many.
- `--delete` — delete products previously seeded from this directory instead of creating. Honours
  `--limit` and `--dry-run`. (Deleting a product removes its photos too.)
- `--dry-run` — print the exact `productSet` input (and planned photos) to stderr; call nothing.

It's **idempotent** via a `seed-lock.json` written into the data directory: it records
`<site>:<handle> → Shopify product id` and its store domain, skips anything already recorded, and
writes after each create (so a crash mid-run doesn't double-create). `--delete` reads that lock,
removes each recorded product, and clears the entries — a quick way to tidy the dev store.

Command files live one-per-file under [`shopify/`](.) and are registered in-process by
[`shopify/register.ts`](shopify/register.ts) (sharing one env/client), rather than as Commander
stand-alone executables.

## Output contract

Commands are pipeable: **stdout carries only machine-readable output** (e.g. the
raw token), while all progress and errors go to **stderr**. So this works:

```
TOKEN=$(ff shopify get-admin-token)
```

Human-facing lines use `info()` ([log.ts](log.ts)) → stderr; `console.log` is
reserved for the data on stdout.
