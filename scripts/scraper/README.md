# scraper

Scrapes real jewellery product data to seed the Shopify dev shop with **test
data** — including full variant structure, so products can be recreated with
their variants. Accuracy is not a goal; this is throwaway data for exercising
the storefront. Products are classified against the project taxonomy so seeded
data carries the same canonical ids the real catalogue will use.

**Current scope:** two sites (`dlouise.com`, `astridandmiyu.com`), category
`ring`, 10 products each.

## How it works

No LLM. Both sites are Shopify storefronts, so we read the collection
`products.json` API — a first-class JSON endpoint returning full product objects
(variants, options, images). It's stable across theme/markup changes and already
structured the way we need. Per product we then:

1. **Classify** the copy against [`taxonomy.json`](taxonomy.json) by **synonym
   matching** ([`classify.py`](src/scraper/classify.py)): for each facet, a
   term's phrases (label + synonyms) are matched as whole words in the
   case/diacritic-folded text. Single-value facets keep the most specific hit
   (longest phrase — `gold vermeil` beats `gold`); multi-value facets keep all.
   Nothing matched → the facet is omitted (omit rather than guess). Subjective
   facets (`design`, `style`) read the product's own copy; attribute facets also
   read tags/option values.
2. **Map variants** ([`product.py`](src/scraper/product.py)): each Shopify option
   becomes an *axis* — size/length, `metal_colour`, or `material` — and colour/
   material swatch labels are normalised to canonical taxonomy ids (`Gold` →
   `yellow-gold`). Every variant's option values, price, sku, weight, barcode and
   availability are recorded, and images are tagged with the variant ids they
   belong to. That's everything a later Shopify import needs.

### Concurrency

Sites are scraped through a shared job queue ([`dispatch.py`](src/scraper/dispatch.py)):
one producer thread per site enqueues a job per product, and a pool of workers
drains the queue. Jobs from every site share one queue, so workers always have
something to dispatch — one site's products download while another's listing is
still loading. Politeness is per-host (`web.fetch` throttles each host
independently), so different sites run in parallel without hammering either.
Adding a site is just another entry in `SITES`; it feeds the same queue.

### Why synonym matching, not embeddings

The taxonomy's synonym lists are comprehensive and domain-specific, and product
copy uses those exact words, so keyword matching is both more reliable and far
lighter than embeddings (which drag in a large model and cross-match near
neighbours like classic/vintage). The design leaves room for an embedding
fallback later if coverage ever needs it.

## Modules

| File | Responsibility |
|------|----------------|
| [`config.py`](src/scraper/config.py) | Constants, concurrency + per-site config (`SITES`). |
| [`web.py`](src/scraper/web.py) | HTTP (per-host throttle) + Shopify JSON access. |
| [`taxonomy.py`](src/scraper/taxonomy.py) | Loads `taxonomy.json` into a typed model. |
| [`classify.py`](src/scraper/classify.py) | Synonym → canonical id matching. |
| [`product.py`](src/scraper/product.py) | Builds the raw `meta.json` and model `product.json`. |
| [`dispatch.py`](src/scraper/dispatch.py) | Concurrent job queue across sites. |
| [`main.py`](src/scraper/main.py) | Orchestration / entry point. |

## Output

```
data/products/<category>/<design>/<id>/meta.json      # the product as the site presents it (raw)
data/products/<category>/<design>/<id>/product.json   # the product in our data model (canonical)
data/products/<category>/<design>/<id>/NN.jpg         # images
```

`<design>` is the exclusive physical facet (mirrors the Shopify collection);
`unclassified` when no design matched. `data/` is git-ignored.

**`meta.json`** is the faithful record — title, vendor, the site's own
product_type, *all* tags, and raw options/variants/images, with no synonym or
canonical conversion.

**`product.json`** is the same product expressed in our data model
([CATEGORISATION.md](CATEGORISATION.md)): canonical `category` + `product_type`,
`tags` limited to namespaced model tags (`design:band`, `style:textured` — never
raw marketing tags), dimension `metafields` (`material`, `gemstones`, …), and
`options` normalised into axes with `canonical` maps for colour/material. It
carries the `variants` needed to recreate the product in our Shopify.

## Run

```
poetry install
poetry run scraper      # scrape both sites concurrently (skips products already on disk)
```
