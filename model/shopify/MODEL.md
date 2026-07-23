# Shopify Data Model

Authoritative spec for the Forged & Found Shopify catalogue data model: metaobject
definitions, metafield definitions, and the variant model. This is what the
migration reconciler (see [MIGRATION.md](./MIGRATION.md)) builds.

The domain vocabulary (categories, designs, styles, dimensions and their synonyms)
lives in [`scripts/scraper/CATEGORISATION.md`](../../scripts/scraper/CATEGORISATION.md)
and [`taxonomy.json`](../../scripts/scraper/taxonomy.json). This document does **not**
restate the vocabulary; it defines how that vocabulary is *represented in Shopify*.

> **Greenfield.** The store is not live. This model does not preserve any existing
> Shopify resources or `apps/web` behaviour. Frontend impact is captured separately
> in `FRONTEND-IMPACT.md`.

---

## 1. Principles

1. **Metaobjects are the backbone.** Every controlled vocabulary is a metaobject, not
   free text or a tag. Metaobjects give us: a human-readable `label` the storefront
   reads directly, typo-prevention at data entry (pick, don't type), human
   extensibility (add an entry → the frontend follows, no code change), and room for
   rich attributes (swatch, image, description).
2. **Dev and live are byte-identical.** No environment or account token appears in any
   type, key, or name. The dev/live distinction lives only in migration config and
   credentials (see MIGRATION.md). Code written against one store works against the
   other unchanged.
3. **Shopify-standard where it semantically matches, custom otherwise.** Always set the
   Shopify Standard Product Taxonomy category (the SEO / Google / marketplace layer).
   Use standard attributes only where they cleanly map; everything jewellery-specific
   is a custom metaobject.
4. **Don't over-constrain.** Constraints exist to protect *code* consumers. Human data
   entry stays resilient: a genuinely new colour/stone is a new metaobject entry, and
   the storefront renders it automatically.
5. **British spelling** throughout (Jewellery, Colour, Vermeil).

---

## 2. Naming conventions

| Resource | Pattern | Example |
|---|---|---|
| Metaobject type | `jewellery_<name>`, lowercase snake | `jewellery_finish` |
| Metaobject display name | Title Case, clean | `Finish` |
| Metafield namespace | always `custom` | `custom` |
| Metafield key | snake_case, no prefix, no `--` | `custom.design` |
| Metaobject entry handle | lowercase kebab, canonical id from `taxonomy.json` | `rose-gold`, `solid-gold-18ct-yellow` |

- The constant `jewellery_` prefix groups our metaobject types in the admin and avoids
  collision with Shopify's reserved `shopify--` standard types. It is **not** an
  environment discriminator.
- `custom` is mandatory for metafields: it is the namespace the merchant Custom Data
  admin UI exposes and the one attachable to variants in that UI.

---

## 3. Shopify-standard vs custom

| Concern | Representation | Notes |
|---|---|---|
| Category | **Standard taxonomy category** + `product_type` | Set on every product. `product_type` = `Ring \| Necklace \| Earring \| Bracelet`. |
| Ring size | Standard **ring-size** attribute (where it maps) | Optional machine-layer addition; the variant axis is a plain option (§5). |
| Material, metal colour | **Custom** (`jewellery_material`, `jewellery_colour`) | Shopify's `jewelry-material` / `color-pattern` are too coarse for vermeil / plated / rose-gold nuance. An optional reference to the standard value can be added later for feeds; omitted from the core spec to avoid over-engineering. |
| finish, design, style, setting, chain_type, stone_shape, gemstone | **Custom** metaobjects | No standard equivalent. |

Data entry fills both the standard category/attributes and the custom fields on the
add-product form.

---

## 4. The definitions (`spec/*.yaml`)

The definitions **are** the YAML — it is the model, not a description of it:

| File | Contents |
|---|---|
| [`spec/metaobjects.yaml`](./spec/metaobjects.yaml) | Metaobject definitions (the controlled vocabularies) and their fields |
| [`spec/metafields.yaml`](./spec/metafields.yaml) | Metafield definitions — the typed slots products and variants carry |
| [`spec/categories.yaml`](./spec/categories.yaml) | Our categories → Shopify Standard Product Taxonomy ids |

The **entries** (the actual values — materials, colours, designs, …) live in
[`vocabulary.json`](./vocabulary.json), applied by `ff shopify model seed-entries`.

Rules the loader ([`src/spec.ts`](./src/spec.ts)) enforces at import time, so a broken
spec fails before any Shopify call is made:

- A `ref` must name a metaobject **declared earlier** in `metaobjects.yaml`. The reconciler
  creates definitions in file order, so a forward reference could not resolve — and a
  metaobject cannot reference itself.
- `ref` is required on `metaobject_reference` / `list.metaobject_reference`, and rejected
  on every other type.
- `choices` is only valid on `single_line_text_field`.
- Metaobject types, field keys within a metaobject, and metafield `owner`+`key` pairs are
  each unique.

Two documentation slots exist and are deliberately different:

- **`description`** is **sent to Shopify** — on metaobject definitions, their fields, and
  metafield definitions — so whoever is entering data reads it in the admin. It is therefore
  worded for them, not for us.
- **`meta:`** stays local: carried through the loader but never sent, as the hook for
  doc-as-code. Use it for the *why* (rationale, `denormalised_from`, …).

They connect in one direction: `meta.description` falls through to `description` when no
explicit `description` is given, so internal wording still reaches the admin rather than being
lost — but an explicit `description` always wins where merchant-facing wording should differ
from developer rationale.

Because descriptions are part of the spec, drift in them is reconciled like anything else: the
diff compares the description on each definition *and* on each field, and emits SAFE updates.

Every metaobject definition is created with **Storefront access = PUBLIC_READ** (headless
requires it) and the **publishable** capability; metafield definitions likewise get
storefront read access so the headless app can query them.


---

## 5. Variant model

> **Decided.** The metal axis is the `jewellery_finish` composite — **one** axis, never
> separate `Material` and `Colour` axes. The alternative and why it was rejected are kept
> in §5.4 so the reasoning isn't re-litigated.

### 5.1 Axis budget

Shopify allows **≤ 3 option axes per product**. Ours:

| Axis | What it carries |
|---|---|
| **Finish** | the `jewellery_finish` composite — material × purity × colour |
| **Size** | the `jewellery_size` composite — ring size *or* length (§5.2) |
| *(spare)* | one axis left for anything genuinely orthogonal (engraving, clasp, …) |

Metal never costs more than one axis and size never costs more than one, so a normal product
uses two of three. **Option order is part of the contract: `Finish`, *[anything else]*,
`Size`** — size is what a shopper picks last, so it renders last.

### 5.2 Size is one property, not two

A ring size and a necklace length are the same *property*: the dimension you pick to fit. So
they are one metaobject, `jewellery_size`, scoped by `category` exactly as `jewellery_design`
is — `N`/`P`/`R` for rings, `45cm`/`50cm` for necklaces.

Making it a metaobject buys what a plain string cannot:

- **Conversions as data** (`uk`/`us`/`eu` for rings, `length_cm`/`length_inches` for chains),
  so the storefront stops parsing strings like `"US 6 / UK L / EU 51"`.
- **Correct ordering** via `sort_order` — `N` before `P`, `45cm` before `50cm`; string sorting
  gets both wrong.
- A controlled vocabulary, and a place to hang size-guide content.

Note these are two separate wins: **unifying** size and length is what frees the third axis;
making it a **metaobject** is what makes the values usable. Neither implies the other.

**Decided: one type, not two.** Splitting into `jewellery_ring_size` and `jewellery_length`
would give denser entries (no null length fields on a ring size, no null `uk`/`us`/`eu` on a
chain length), but it splits one property into two vocabularies and forces the storefront to
branch on category before it can read a size. We keep a single `jewellery_size` and accept
that each entry fills only the conversion fields relevant to its category.

### 5.3 One axis in the data ≠ one selector in the UI

Every finish carries structured `material` / `purity` / `colour`, so the storefront can pivot a
product's finishes into as many dependent selectors as it wants — e.g. Material, then Colour
filtered to the colours that exist for the chosen material.

This is strictly *more* capable than real separate axes: the valid combinations are enumerated
by the finish set, so a dependent selector can only ever offer combinations that exist. With
separate axes the frontend would have to detect and grey out impossible pairs itself. The cost
is the dependent-dropdown logic; the benefit is that it stays optional — ship a single Finish
selector, split it later, with no data migration either way.

### 5.4 Alternative considered — separate Material and Colour axes

`Material + Colour + Size` = 3 axes, leaving **nothing for purity** (18ct and 14ct of one
design could not be variants of it) and nothing spare. Shopify does not force the full cross
product, so impossible pairs can simply not be created — but the storefront must then grey them
out, and the ceiling remains. Only preferable if the catalogue will never vary purity and never
needs a third axis.


---

## 6. Category scoping

Shopify **cannot** conditionally show/hide *custom* metafields by category (only its own
standard category attributes do that). So scoping is by data + validation, not by Shopify:

- One `custom.design` metafield → `jewellery_design`, each design entry carrying a
  `category` field. Not per-category definitions (which would give N form fields with no
  native scoping benefit).
- Enforcement is soft: data entry / a migration-side validation checks a product's
  `design.category` matches its `product_type`. The storefront filters off the design
  metaobject regardless.

---

## 7. Filtering & search

Storefront `ProductFilter` accepts `productMetafield`, `variantMetafield`, `variantOption`,
`category`, `taxonomyMetafield`, `productType`, `productVendor`, `tag`, `price`, `available`.
Metaobject *fields* (e.g. `material` inside a finish) are **not** filterable — which is exactly
why the facets are projected onto the product as well.

**Purity, colour, material and size all stay filterable under the finish model** — via those
projections, not via the finish itself:

| What the shopper filters on | How it resolves |
|---|---|
| Material · Metal Colour · Purity · Size | `productMetafield` on `custom.material` / `custom.metal_colour` / `custom.purity` / `custom.size` |
| A specific finish or size | `variantMetafield` on `custom.finish` / `custom.size` |
| A visible option value | `variantOption` on `Finish` / `Size` |
| Category | `category` — the standard taxonomy id set on every product (§3) |

So the metal attributes are stored **twice, deliberately**:

- **Source of truth (variant selection):** the `jewellery_finish` on each variant.
- **Filter projection (collection pages):** product-level `custom.material`,
  `custom.metal_colour`, `custom.purity`, `custom.size` — the distinct values across the
  product's variants.

Two caveats worth designing around:

- **Product-scoped, not variant-scoped.** A product offered in rose gold *and* silver matches a
  "Rose Gold" filter as a whole; the card then has to choose the matching variant to display.
  If variant-scoped facet filtering is ever needed, the same values can additionally be
  denormalised onto the *variant* and filtered via `variantMetafield` — at the cost of more
  projection to keep in sync.
- **Free-text search** indexes title/tags/type/vendor plus configured metafields; it does not
  reach inside metaobjects. If "rose gold" must match by *search* as well as by filter, surface
  the label somewhere indexed — the option value already carries it.

Enabling and ordering the filter UI is configured in the **Search & Discovery** app (manual).
The migration only guarantees the definitions exist with storefront access. The projections are
only as correct as whatever maintains them — see §8.


---

## 8. Cardinality & validation (soft, enforced in code — not Shopify)

| Rule | Where enforced |
|---|---|
| Exactly one `design`; `design.category` = `product_type` | data entry + migration validation |
| Zero-or-more `style`, `gemstone`, `stone_shape` | metafield list types |
| Finish combinations are valid by construction (only valid entries exist) | metaobject entry curation |
| `custom.material` / `metal_colour` / `purity` / `size` reflect the product's variants | denormalisation step |
| `size.category` = `product_type` (a ring cannot take a 45cm length) | data entry + validation |

**Projection staleness is an open risk.** The denormalised filter fields are written by the
seeder and by nothing else — a human editing a variant's finish or size in the admin leaves
them stale, and they are precisely what collection filters read. Options: recompute on
product-update (Shopify Flow or our own webhook), a periodic reconcile command in `ff`, or
accept manual maintenance. Unresolved.

---

## 9. To verify against Admin API `2026-01` (during Phase 2)

- Metaobject type charset (lowercase snake assumed) and metafield key length limits.
- Current max option axes per product.
- Storefront exposure of native linked-metafield option values (drives the finish-wiring spike).
- Whether Search & Discovery filter enablement/order is scriptable or manual-only.

---

## 10. Scraper second pass (downstream)

After this model is pinned, `taxonomy.json` + the classifier need re-aligning:
`material`/`metal_colour`/`purity` collapse into curated `jewellery_finish` combinations;
facet outputs become `custom.*` metaobject handles; tags/collection representation is
dropped in favour of the metaobject/metafield representation above.
