// The variant domain boundary.
//
// `toVariant` is the only place generated GraphQL shapes are unpacked: it reads
// the model bindings (custom.finish / custom.size metaobjects) off a variant
// fragment and returns a plain `Variant`. Everything downstream — selector,
// cards, cart lines — consumes this type and never touches option strings or
// metaobject unions.
//
// The metafields are the source of truth (FRONTEND-IMPACT.md §4). Option values
// are only a display fallback for the seeder's known edge case: an unresolved
// finish leaves the raw scraped string as the option value with no metafield.

import {FragmentType, useFragment as unmask} from "@/graphql/generated";
import {VariantMeta_ProductVariantFragmentDoc} from "@/graphql/generated/graphql";

export type Availability = "AVAILABLE" | "BACKORDER" | "OUT_OF_STOCK";

export interface Money {
  amount: number;
  currencyCode: string;
}

export interface VariantImage {
  id: string | null;
  url: string;
  altText: string | null;
  thumbhash?: string | null;
  width?: number | null;
  height?: number | null;
  thumbnail?: string;
}

export interface Colour {
  handle: string;
  label: string;
  /** Optional swatch image for metals a flat colour can't show (two-tone). */
  image: {url: string; altText: string | null} | null;
}

export interface Finish {
  handle: string;
  label: string;
  purity: string | null;
  material: {handle: string; label: string} | null;
  colour: Colour | null;
}

export interface Size {
  handle: string;
  label: string;
  sortOrder: number;
}

export interface Variant {
  id: string;
  availability: Availability;
  price: Money;
  compareAtPrice: Money | null;
  image: VariantImage | null;
  finish: Finish | null;
  size: Size | null;
  /**
   * Stable selection keys: the metaobject handle when the binding resolved,
   * else the raw option value. Null when the variant has no such axis at all.
   */
  finishKey: string | null;
  sizeKey: string | null;
  /** What to show: the authored finish label, else the raw option value. */
  finishLabel: string | null;
  sizeLabel: string | null;
}

/** The structural shape both variant fragments satisfy. */
export type VariantSource = {
  id: string;
  availableForSale: boolean;
  currentlyNotInStock: boolean;
  selectedOptions: {name: string; value: string}[];
  price: Money;
  compareAtPrice: Money | null;
  image?: VariantImage | null;
} & FragmentType<typeof VariantMeta_ProductVariantFragmentDoc>;

const getAvailability = (v: {availableForSale: boolean; currentlyNotInStock: boolean}): Availability => {
  if (!v.availableForSale) return "OUT_OF_STOCK";
  if (v.currentlyNotInStock) return "BACKORDER";
  return "AVAILABLE";
};

// The option names the seeder writes (scripts/cli/shopify/seed/model.ts).
const optionValue = (source: VariantSource, name: string): string | null =>
  source.selectedOptions.find((o) => o.name.toLowerCase() === name)?.value ?? null;

type MetaReference = {__typename: string} | null | undefined;

/** Narrow a metafield/field reference union to its Metaobject arm. */
function metaobject<T extends MetaReference>(ref: T): Extract<T, {__typename: "Metaobject"}> | null {
  return ref?.__typename === "Metaobject" ? (ref as Extract<T, {__typename: "Metaobject"}>) : null;
}

export function toVariant(source: VariantSource): Variant {
  const meta = unmask(VariantMeta_ProductVariantFragmentDoc, source);

  const finishRef = metaobject(meta.finish?.reference);
  const materialRef = metaobject(finishRef?.material?.reference);
  const colourRef = metaobject(finishRef?.colour?.reference);
  const colourImage = colourRef?.image?.reference;

  const finish: Finish | null = finishRef
    ? {
      handle: finishRef.handle,
      label: finishRef.label?.value ?? finishRef.handle,
      purity: finishRef.purity?.value ?? null,
      material: materialRef
        ? {handle: materialRef.handle, label: materialRef.label?.value ?? materialRef.handle}
        : null,
      colour: colourRef
        ? {
          handle: colourRef.handle,
          label: colourRef.label?.value ?? colourRef.handle,
          image: colourImage?.__typename === "MediaImage" && colourImage.image
            ? {url: colourImage.image.url, altText: colourImage.image.altText}
            : null,
        }
        : null,
    }
    : null;

  const sizeRef = metaobject(meta.size?.reference);
  const size: Size | null = sizeRef
    ? {
      handle: sizeRef.handle,
      label: sizeRef.label?.value ?? sizeRef.handle,
      sortOrder: sizeRef.sortOrder?.value != null ? Number(sizeRef.sortOrder.value) : Number.MAX_SAFE_INTEGER,
    }
    : null;

  const finishOption = optionValue(source, "finish");
  const sizeOption = optionValue(source, "size");

  return {
    id: source.id,
    availability: getAvailability(source),
    price: source.price,
    compareAtPrice: source.compareAtPrice ?? null,
    image: source.image ?? null,
    finish,
    size,
    finishKey: finish?.handle ?? finishOption,
    sizeKey: size?.handle ?? sizeOption,
    finishLabel: finish?.label ?? finishOption,
    sizeLabel: size?.label ?? sizeOption,
  };
}
