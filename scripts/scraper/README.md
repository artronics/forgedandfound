# scraper

Scrapes real jewellery product data to seed the Shopify dev shop with **test
data** — including full variant structure, so products can be recreated with
their variants. Products are classified against the project taxonomy so seeded
data carries the same canonical ids the real catalogue will use.

Any one product's accuracy is not the goal; this is throwaway data. But a *bad*
product costs real time downstream — one with no material seeds into Shopify
with no finish on any variant, one whose copy contradicts itself seeds with the
wrong one — so the scraper is deliberately picky and drops far more than it
keeps. A category that can't fill its quota simply doesn't.

**Scope:** nine Shopify storefronts, all four categories, quotas per site. See
[`sites.toml`](sites.toml) for the roster, and for the candidate brands that
**can't** be scraped this way (Mejuri is headless Hydrogen; Monica Vinader and
Brilliant Earth sit behind Cloudflare; Gabriel and David Yurman aren't Shopify).

## How it works

No LLM. Every site is a Shopify storefront, so we page the collection
`products.json` API — a first-class JSON endpoint returning full product objects
(variants, options, images). It's stable across theme/markup changes and already
structured the way we need. Per product we then:

1. **Classify** the copy against [`taxonomy.json`](taxonomy.json) by **synonym
   matching** ([`classify.py`](src/scraper/classify.py)): for each facet, a
   term's phrases (label + synonyms) are matched as whole words in the
   case/diacritic/punctuation-folded text. Single-value facets read the copy in
   **authority order** — title first, then the fuller marketing copy, then tags
   and option values — and the first tier that answers wins. Within a tier the
   most specific hit wins (longest phrase: `gold vermeil` beats `gold`).
   Multi-value facets keep every match. Nothing matched → the facet is omitted
   (omit rather than guess).
2. **Judge** it against the quality gate ([`quality.py`](src/scraper/quality.py),
   thresholds in `sites.toml`). Every rejection carries a named reason, tallied
   per site in the run report.
3. **Map variants** ([`product.py`](src/scraper/product.py)): each Shopify option
   becomes an *axis* — size or metal — and metal swatch labels are normalised to
   canonical taxonomy ids (`Gold` → `yellow-gold`). Whether a metal option varies
   the *material* or the *colour* is decided by its values, not its name.
   Everything a later Shopify import needs is recorded: option values, price,
   sku, weight, barcode, availability, and images tagged with their variant ids.

### Why titles outrank tags

Tags are merchandising surface. Missoma files a plated ring under `solid gold`
so it appears in that edit; Aurée tags a vermeil piece `sterling silver` because
a vermeil core *is* silver. Reading tags as equal to the title is what
previously classified a vermeil ring as sterling silver, and a ring titled
"… in Gold" as sterling silver. Titles are curated and specific — "Molten Olive
Stacking Ring 18ct Gold Plated" says exactly what the piece is.

### What gets dropped

| Reason | What it catches |
|--------|-----------------|
| `not_a_product` | Gift cards, vouchers, care kits, and multi-piece listings (a "Ring Set" is not one product). |
| `no_design` | Nothing matched the design facet — it would land in `unclassified/`. |
| `no_metal` | No material, and no metal axis to supply one per variant. The seeder would have nothing to resolve. |
| `metal_contradiction` | The classified material/colour/purity matches **no** curated finish — copy contradicting itself. |
| `personalisation` | An Initial/Letter/Zodiac axis: dozens of near-identical variants saying nothing about the model. |
| `quantity_axis` | An axis choosing *how many* (Pair/Single), whatever it calls itself. |
| `unmapped_axis` | A dimension the model can't carry (Gemstone, Carat, "Sold as"). |
| `too_many_variants`, `out_of_stock`, `no_images`, `no_price` | Configurators and things with nothing to show or sell. |

`metal_contradiction` uses the same relaxed matching rule as the seeder (an
unset facet on either side is a wildcard) against the curated
[`jewellery_finish`](../../model/shopify/vocabulary.json) vocabulary — so a
product that survives here is one that will resolve to a finish there.

### Quotas

`limit` is per **site**, split evenly across the categories that site has. A
category that can't fill its share does not borrow from the others. Because
filtering rejects most candidates, each category pages through up to
`oversample ×` its quota before giving up.

### Concurrency

One producer thread per site *decides* — pages the listing, applies the gate,
enqueues keepers up to quota — and a pool of workers drains the shared queue
doing the expensive part, downloading photos and writing records
([`dispatch.py`](src/scraper/dispatch.py)). Deciding in the producer is what
makes the quota work: we stop paging a category the moment its share is filled,
and never download images for a product we'd throw away.

Politeness is per-host *and* global ([`web.py`](src/scraper/web.py)): Shopify
storefronts share infrastructure that rate-limits by client IP across all of
them, so nine well-behaved producers still add up to one impolite client. The
image CDN is exempt from the strict spacing — it's built to serve images and
isn't what limits us.

### Why synonym matching, not embeddings

The taxonomy's synonym lists are comprehensive and domain-specific, and product
copy uses those exact words, so keyword matching is both more reliable and far
lighter than embeddings (which drag in a large model and cross-match near
neighbours like classic/vintage). The design leaves room for an embedding
fallback later if coverage ever needs it.

## Modules

| File | Responsibility |
|------|----------------|
| [`sites.toml`](sites.toml) | The roster, quotas and quality thresholds. Data, not code. |
| [`config.py`](src/scraper/config.py) | Runtime constants; loads and validates `sites.toml`. |
| [`web.py`](src/scraper/web.py) | HTTP (per-host + global throttle) and paged Shopify JSON access. |
| [`taxonomy.py`](src/scraper/taxonomy.py) | Loads `taxonomy.json` into a typed model. |
| [`classify.py`](src/scraper/classify.py) | Synonym → canonical id matching, in authority order. |
| [`quality.py`](src/scraper/quality.py) | The gate: keep or reject, with a named reason. |
| [`product.py`](src/scraper/product.py) | Builds the raw `meta.json` and model `product.json`. |
| [`dispatch.py`](src/scraper/dispatch.py) | Quotas, pagination and the concurrent job queue. |
| [`main.py`](src/scraper/main.py) | CLI, orchestration, run report. |

## Output

```
<output_dir>/products/<category>/<design>/<id>/meta.json      # the product as the site presents it (raw)
<output_dir>/products/<category>/<design>/<id>/product.json   # the product in our data model (canonical)
<output_dir>/products/<category>/<design>/<id>/NN.jpg         # images
```

`<design>` is the exclusive physical facet (mirrors the Shopify collection).
`output_dir` defaults to the value in `sites.toml`; `--out` and `SEED_DATA_DIR`
override it.

**`meta.json`** is the faithful record — title, vendor, the site's own
product_type, *all* tags, and raw options/variants/images, with no synonym or
canonical conversion.

**`product.json`** is the same product expressed in our data model
([model/shopify/MODEL.md](../../model/shopify/MODEL.md)): canonical `category` +
`product_type`, and each classified facet as a metaobject **handle** —
single-valued `design`/`material`/`metal_colour`/`purity`/`setting`/`chain_type`
and multi-valued `styles`/`gemstones`/`stone_shapes`. `options` are normalised
into axes with `canonical` maps for metal, alongside the `variants` needed to
recreate the product. The seeder (`ff shopify seed products`) resolves each
handle to a Shopify metaobject GID, composes the per-variant `finish` (material +
purity + colour), and sets the `custom.*` metafields.

## Run

```
poetry install
poetry run scraper                          # every site and category, per-site quotas from sites.toml
poetry run scraper --list-sites             # the roster, and what can't be scraped
poetry run scraper --dry-run                # fetch, classify and filter; write nothing
poetry run scraper -s missoma.com -c ring   # narrow (both repeatable)
poetry run scraper --limit 4                # products per site, split across its categories
poetry run scraper --refresh                # re-scrape what's already on disk instead of skipping
poetry run scraper -v                       # log every rejection with its reason
```

Runs are incremental: anything already on disk is skipped, so re-running tops up
rather than starting over. Use `--refresh` after changing the taxonomy or the
quality rules — a stale classification is worse than none.
