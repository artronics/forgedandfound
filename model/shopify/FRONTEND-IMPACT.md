# Frontend Impact

The migration ([MODEL.md](./MODEL.md) / [MIGRATION.md](./MIGRATION.md)) replaces the ad-hoc
metafield/metaobject shape the `apps/web` storefront reads today with the new model. Because
the store is **greenfield**, we did not preserve the old keys — so the storefront **will
break** until updated. This document is the remediation guide: what changed, which files to
touch, and what new work the model asks for. It is a checklist for a later frontend task, not
part of the migration itself.

> Good news up front: the one pattern worth keeping — **reading a `label` field off each
> metaobject for display** — is unchanged. `getLabel()` in
> [useCandidateVariant.ts](../../apps/web/lib/product/useCandidateVariant.ts) already does
> exactly this; every new metaobject carries a `label`.

---

## 1. Contract change (old → new)

| Concern | Old (what the storefront reads today) | New (this model) |
|---|---|---|
| Design | product `custom.necklace_style` → metaobject, filter labelled "Design" | `custom.design` → `jewellery_design` (one metaobject, `category` field) |
| Style | collection `custom.styles` → metaobject list | product `custom.style` (list) → `jewellery_style` |
| Material | `shopify.jewelry-material` (standard metaobject) | `custom.material` (list, denormalised) → `jewellery_material` + `finish.material` |
| Metal colour | `shopify.color-pattern` (standard metaobject) | `custom.metal_colour` (list, denormalised) → `jewellery_colour` + `finish.colour` |
| Purity | — | `custom.purity` (list text) + `finish.purity` |
| Size / metal variant | `custom.necklace_size` metaobject + raw variant options | **Finish** (`custom.finish` variant metafield → `jewellery_finish`) + plain size/length option |
| Metaobject `type` matched in code | `shopify--color-pattern`, `shopify--jewelry-material`, `necklace_size` | `jewellery_colour`, `jewellery_material`, `jewellery_finish`, `jewellery_design`, … |
| Display value | metaobject field `label` | **unchanged** — same `label` field |
| Shop hero | `ff_shop.hero_image` | unchanged — not in migration scope |

Storefront filter ids keep the shape `filter.p.m.custom.<key>` and stay metaobject-backed, so
the existing base64/gid handling still applies — only the keys and labels change.

---

## 2. File-by-file

### `lib/product/useCandidateVariant.ts` — rewrite the identifiers + type matchers
Today it reads variant colour/material/size from `shopify.color-pattern`, `shopify.jewelry-material`
and `custom.necklace_size`, matching on those metaobject `type`s
([useCandidateVariant.ts:36-64](../../apps/web/lib/product/useCandidateVariant.ts:36)).

New: read the variant's **`custom.finish`** metafield → a `jewellery_finish` metaobject, then
read its `material` / `colour` / `purity` fields (material/colour are themselves metaobject
references carrying a `label`). One read gives the whole metal story per variant. `getLabel`
is reusable; `isColour`/`isMaterial`/`isSize` matchers change from `shopify--*` / `necklace_size`
to the `jewellery_*` types (or are replaced by reading the finish's fields directly).

### `components/collection/Collection.tsx` + `components/search/SearchResults.tsx` — filter groups
`convertFilters()` groups storefront filters by matching the filter **label** against
`"design"`/`"material"`/`"colour"`
([Collection.tsx:324-374](../../apps/web/components/collection/Collection.tsx:324)). Filter
labels now come from the new metafield definition **names** — `Design`, `Material`,
`Metal Colour`, `Style`, `Setting`, `Chain Type`, `Gemstone`, `Stone Shape`. Update the group
detection to the new set, and decide which to surface. `extractId()` (metaobject gid → b64)
still applies unchanged.

### `lib/shopify/graphql/product.graphql` — `GetProductMetafields` identifiers
Update the `identifiers` list from `{shopify,color-pattern}` / `{shopify,jewelry-material}` /
`{custom,necklace_size}` to the new `custom.*` keys the PDP needs (at minimum `custom.finish`
on the variant, plus product `custom.design`/`style`/…). Regenerate GraphQL types afterwards
(`pnpm codegen`).

### `lib/menu/menu.ts` + `lib/shopify/graphql/shop.graphql` — collection styles
These read a collection-level `custom.styles` metaobject list
([shop.graphql:71](../../apps/web/lib/shopify/graphql/shop.graphql:71),
[menu.ts:65-77](../../apps/web/lib/menu/menu.ts:65)). The model expresses style as a **product**
metafield (`custom.style`). Decide whether menu/merchandising still wants a curated
collection-level style list (keep a collection metafield, not in the migration scope) or should
derive from product data. Flag for the merchandising/menu owner.

### Anything reading `shopify.jewelry-material` / `shopify.color-pattern`
These standard attributes are no longer the source of truth for on-site material/colour (we use
custom metaobjects for jewellery nuance). Keep setting the **standard category + attributes** on
products for SEO/feeds (MODEL.md §3), but read the `custom.*` metaobjects on the storefront.

---

## 3. New work the model introduces

### Finish selector (the variant model)
Products vary by a single **Finish** option whose values map to `jewellery_finish` metaobjects
(material + purity + colour collapsed into one axis). The PDP should render **one** Finish
selector — swatch + label from the finish/colour metaobject — instead of separate
material/purity/colour selectors. This is *simpler* than the old multi-facet handling. See
§4 for how the option binds to the metaobject (the wiring).

### Denormalised filters
Collection filtering reads **product-level** metafields, so material/metal-colour/purity are
denormalised onto the product (`custom.material` / `custom.metal_colour` / `custom.purity`) in
addition to living inside each finish (MODEL.md §8). The storefront filters on those product
metafields; the finish drives *variant selection*. Enabling/ordering the filter UI is a
**Search & Discovery** app step (manual) — the definitions already have storefront access.

### Metaobject swatches
`jewellery_colour` carries a `swatch` (hex) and optional `image`; `jewellery_finish` can
override `swatch`. Use these for the finish/colour swatch UI instead of hardcoded colour maps.

---

## 4. The finish↔variant wiring

A variant's finish is exposed as the **`custom.finish` variant metafield** (`metaobject_reference`
→ `jewellery_finish`) — provisioned by the migration. The storefront reads it directly off each
variant. The visible **"Finish" product option** (a plain option whose values are the finish
labels) is set per product at seeding time and paired with this metafield.

Optional enhancement: Shopify's **native metaobject-linked options** can connect the "Finish"
option to the `custom.finish` metafield so the admin shows a metaobject picker and the
storefront exposes `optionValues[].swatch` natively. That is additive on top of the same
metafield — evaluate it during product seeding; the storefront can ship on the direct-read
approach first.

---

## 5. Rollout

Greenfield → no data migration, no dual-read compatibility window needed. Sequence:
1. Migration provisions definitions (done) + entries (`seed-entries`).
2. Update the storefront reads/queries above; `pnpm codegen`.
3. Configure filters in Search & Discovery.
4. Seed products (after the scraper's second pass) so there is data to render.
