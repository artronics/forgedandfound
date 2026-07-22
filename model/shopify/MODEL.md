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
| Ring size | Standard **ring-size** attribute (where it maps) | Optional machine-layer addition; the variant axis is a plain option (§6). |
| Material, metal colour | **Custom** (`jewellery_material`, `jewellery_colour`) | Shopify's `jewelry-material` / `color-pattern` are too coarse for vermeil / plated / rose-gold nuance. An optional reference to the standard value can be added later for feeds; omitted from the core spec to avoid over-engineering. |
| finish, design, style, setting, chain_type, stone_shape, gemstone | **Custom** metaobjects | No standard equivalent. |

Data entry fills both the standard category/attributes and the custom fields on the
add-product form.

---

## 4. Metaobject definitions

All metaobject definitions are created with **Storefront access = PUBLIC_READ** (headless
requires this) and the **publishable** capability enabled.

Field type key: `text` = `single_line_text_field`, `text[]` = `list.single_line_text_field`,
`ref→X` = `metaobject_reference` constrained to definition `X`, `color` = Shopify `color`
field, `file` = `file_reference`, `int` = `number_integer`.

### 4.1 `jewellery_material` — “Material”

| Field | Type | Req | Notes |
|---|---|---|---|
| `label` | text | ✓ | Display, e.g. "Gold Vermeil" |
| `description` | multi_line_text | – | Optional editorial |

Entries (canonical ids from taxonomy `material` facet): `solid-gold`, `gold-vermeil`,
`gold-plated`, `sterling-silver`, `platinum`, `stainless-steel`, `mixed-metal`.

### 4.2 `jewellery_colour` — “Colour”

| Field | Type | Req | Notes |
|---|---|---|---|
| `label` | text | ✓ | Display, e.g. "Rose Gold" |
| `swatch` | color | ✓ | Hex for the swatch UI |
| `image` | file | – | Optional textured/metal swatch image |

Entries (taxonomy `metal_colour`): `yellow-gold`, `white-gold`, `rose-gold`, `silver`,
`two-tone`.

### 4.3 `jewellery_finish` — “Finish” (composite variant axis)

The composite that collapses the entangled metal attributes (material × purity × colour)
into **one** value, so they never become separate variant axes (which would breach the
≤3-axis limit and generate invalid combinations). Each entry **is** a valid combination;
invalid combinations simply never get created.

| Field | Type | Req | Notes |
|---|---|---|---|
| `label` | text | ✓ | Display, e.g. "18ct Rose Gold Vermeil", "Sterling Silver" |
| `material` | ref→`jewellery_material` | ✓ | |
| `purity` | text (choices: `18ct`,`14ct`,`9ct`,`925`) | – | Choice field — no metaobject; purity has no extra attributes |
| `colour` | ref→`jewellery_colour` | – | Optional — a finish may be colour-agnostic |
| `swatch` | color | – | Optional override; otherwise derived from `colour.swatch` |
| `sort_order` | int | – | Optional display ordering |

Entry handle convention: `<material>[-<purity>][-<colour>]`, e.g. `solid-gold-18ct-yellow`,
`vermeil-18ct-rose`, `sterling-silver`. Finishes are a **curated** set created as products
need them, not a full Cartesian pre-fill.

### 4.4 `jewellery_design` — “Design” (category-scoped, single per product)

| Field | Type | Req | Notes |
|---|---|---|---|
| `label` | text | ✓ | Display, e.g. "Solitaire" |
| `category` | text (choices: `ring`,`necklace`,`earring`,`bracelet`) | ✓ | The scoping field — see §7 |
| `description` | multi_line_text | – | |

Entries: the 37 designs in `CATEGORISATION.md` §4, each tagged with its `category`.

### 4.5 `jewellery_style` — “Style” (cross-category, many per product)

| Field | Type | Req | Notes |
|---|---|---|---|
| `label` | text | ✓ | e.g. "Vintage" |
| `description` | multi_line_text | – | |

Entries: the 15 styles in `CATEGORISATION.md` §5.

### 4.6 Dimension metaobjects (label-only unless noted)

| Type | Display | Fields | Entries (taxonomy facet) |
|---|---|---|---|
| `jewellery_gemstone` | Gemstone | `label`✓, `description`– | `gemstone` (22) |
| `jewellery_stone_shape` | Stone Shape | `label`✓ | `stone_shape` (15) |
| `jewellery_setting` | Setting | `label`✓, `description`– | `setting` (6) |
| `jewellery_chain_type` | Chain Type | `label`✓ | `chain_type` (11) |

---

## 5. Metafield definitions

All product/collection metafield definitions are created with **Storefront access = read**
so the headless app can query them. `ref→X` = `metaobject_reference` constrained to
definition `X`; `list ref→X` = `list.metaobject_reference`.

### 5.1 Product metafields

| Key | Type | Card. | Filterable | Purpose |
|---|---|---|---|---|
| `custom.design` | ref→`jewellery_design` | one | ✓ | Category-scoped design |
| `custom.style` | list ref→`jewellery_style` | many | ✓ | Cross-category styles |
| `custom.gemstone` | list ref→`jewellery_gemstone` | many | ✓ | |
| `custom.stone_shape` | list ref→`jewellery_stone_shape` | many | ✓ | |
| `custom.setting` | ref→`jewellery_setting` | one | ✓ | |
| `custom.chain_type` | ref→`jewellery_chain_type` | one | ✓ | |
| `custom.material` | list ref→`jewellery_material` | many | ✓ | **Denormalised** from the product's finishes — for collection filtering (§8) |
| `custom.metal_colour` | list ref→`jewellery_colour` | many | ✓ | **Denormalised** from finishes — for filtering |
| `custom.purity` | text[] (choices `18ct`,`14ct`,`9ct`,`925`) | many | ✓ | **Denormalised** from finishes — for filtering |

### 5.2 Variant metafields

| Key | Owner | Type | Card. | Purpose |
|---|---|---|---|---|
| `custom.finish` | variant | ref→`jewellery_finish` | one | Each variant's composite finish |

**Wiring (spike resolved).** Admin API `2026-01` confirms `ProductOption.linkedMetafield`
exists and the Storefront exposes `ProductOptionValue.swatch` (colour/image) natively — but
**not** the linked metaobject's structured fields. So the reliable substrate is this
**`custom.finish` variant metafield**, which the storefront reads directly to get
material/purity/colour off the finish metaobject. The visible **"Finish" product option** is
set per product at seeding time; it can *optionally* be natively linked to this same metafield
(`linkedMetafield`) for admin metaobject-picker + native option-value swatches. Direct-read is
the default and ships without the native feature; linking is additive on the same key.

---

## 6. Variant model

- **≤ 3 option axes per product** (platform limit — confirm exact current limit against
  Admin API `2026-01`).
- Axes, in priority order: **Finish** (the `jewellery_finish` composite), **Size**,
  **Length** (necklaces). A product uses only the axes it actually varies by.
- **Finish** absorbs all metal-composition variation, so material/purity/colour are
  never their own axes. A product that varies only by colour picks finishes that differ
  only in `colour`; one that varies by full composition picks finishes that differ across
  material/purity/colour.
- **Size / Length** are plain-string options for now (e.g. `N`, `US 6.5`, `18"`, `S/M/L`).
  Upgrade to a metaobject later only if size-guide/conversion UX demands it.
- Only variant-differentiating attributes are axes; everything else is a product metafield.

---

## 7. Category scoping

Shopify **cannot** conditionally show/hide *custom* metafields by category (only its own
standard category attributes do that). So scoping is by data + validation, not by Shopify:

- One `custom.design` metafield → `jewellery_design`, each design entry carrying a
  `category` field. Not per-category definitions (which would give N form fields with no
  native scoping benefit).
- Enforcement is soft: data entry / a migration-side validation checks a product's
  `design.category` matches its `product_type`. The storefront filters off the design
  metaobject regardless.

---

## 8. Filtering & denormalisation

Storefront collection filters are cleanest on **product-level metafields**; metaobject
*fields* (e.g. `material` inside a finish) are not directly filterable. So the metal
attributes are stored **twice, deliberately**:

- **Source of truth (variant selection):** the `jewellery_finish` metaobject on each variant.
- **Filter projection (collection pages):** product-level `custom.material`,
  `custom.metal_colour`, `custom.purity` — the distinct values across the product's finishes.

Populating the projection is a data-entry step now; a later sync (custom app or a
migration phase) can automate it from the finishes. Enabling/ordering the actual filter
UI is configured in the **Search & Discovery** app (manual; verify any API surface in
`2026-01`). The migration only guarantees the definitions exist with storefront access
and are filter-eligible.

---

## 9. Cardinality & validation (soft, enforced in code — not Shopify)

| Rule | Where enforced |
|---|---|
| Exactly one `design`; `design.category` = `product_type` | data entry + migration validation |
| Zero-or-more `style`, `gemstone`, `stone_shape` | metafield list types |
| Finish combinations are valid by construction (only valid entries exist) | metaobject entry curation |
| `custom.material` / `metal_colour` / `purity` reflect the product's finishes | denormalisation step |

---

## 10. To verify against Admin API `2026-01` (during Phase 2)

- Metaobject type charset (lowercase snake assumed) and metafield key length limits.
- Current max option axes per product.
- Storefront exposure of native linked-metafield option values (drives the finish-wiring spike).
- Whether Search & Discovery filter enablement/order is scriptable or manual-only.

---

## 11. Scraper second pass (downstream)

After this model is pinned, `taxonomy.json` + the classifier need re-aligning:
`material`/`metal_colour`/`purity` collapse into curated `jewellery_finish` combinations;
facet outputs become `custom.*` metaobject handles; tags/collection representation is
dropped in favour of the metaobject/metafield representation above.
