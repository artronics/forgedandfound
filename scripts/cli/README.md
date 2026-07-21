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
ff shopify seed products -d ./data --delete [--limit N]        # delete what was seeded from that data
ff aws cognito-delete-all                                      # delete up to 4 Cognito users (nonprod only)
```

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

- `--limit N` — process at most N products.
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
