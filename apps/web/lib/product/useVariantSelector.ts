"use client";
import {VariantSelector_ProductFragment, VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {useMemo, useState} from "react";
import {unique} from "@/lib/utils";
import {FragmentType, useFragment} from "@/graphql/generated";
import {VariantModel} from "@/lib/model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UseVariantSelectorProps = {
  fragment: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null;
};

type ProductVariantFragment = VariantSelector_ProductFragment | null;
type Variant = VariantSelector_ProductFragment["variants"]["edges"][number]["node"];

const useAvailableVariants = (product: ProductVariantFragment) =>
  useMemo(
    () =>
      product?.variants.edges
        .map((e) => e?.node)
        .filter((v): v is Variant => !!v && VariantModel.getAvailability(v) === "AVAILABLE") ?? [],
    [product],
  );

/**
 * Drives a three-axis variant selector backed entirely by raw Shopify
 * `selectedOptions` data.  No custom type mappers or finish/axis abstractions.
 *
 * Selection cascade:
 *   1. Colour  (option name === "Color" / "Colour") — present only when the
 *      product has a colour option.
 *   2. Material (option name === "Jewellery Material" / "Material")
 *   3. Size    (any option name containing "size")
 *
 * Each axis is re-derived from the variants that survive the upstream
 * selections, so unavailable combinations naturally disappear.
 */
export function useVariantSelector({fragment}: UseVariantSelectorProps) {
  const product = useFragment(VariantSelector_ProductFragmentDoc, fragment);
  const availableVariants = useAvailableVariants(product);

  // Axis 1: Colour
  const hasColour = availableVariants.some((v) =>
    v.selectedOptions.some((o) => VariantModel.isOptionColour(o.name)),
  );

  const colours = useMemo(
    () =>
      hasColour
        ? unique(availableVariants.map((v) => VariantModel.getColourOption(v)).filter(Boolean) as string[])
        : [],
    [availableVariants, hasColour],
  );

  const [selectedColour, setSelectedColour] = useState<string | null>(
    () => colours[0] ?? null,
  );

  // Keep selection valid when the colour list changes (e.g. on fragment swap).
  const resolvedColour = colours.includes(selectedColour ?? "")
    ? selectedColour
    : colours[0] ?? null;

  // Variants that match the selected colour (or all variants when there is no
  // colour axis on this product).
  const afterColour = useMemo(
    () =>
      hasColour
        ? availableVariants.filter((v) => VariantModel.getColourOption(v) === resolvedColour)
        : availableVariants,
    [availableVariants, hasColour, resolvedColour],
  );

  // Axis 2: Material
  const materials = useMemo(
    () =>
      unique(afterColour.map((v) => VariantModel.getMaterialOption(v)).filter(Boolean) as string[]),
    [afterColour],
  );

  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(
    () => materials[0] ?? null,
  );

  const resolvedMaterial = materials.includes(selectedMaterial ?? "")
    ? selectedMaterial
    : materials[0] ?? null;

  const afterMaterial = useMemo(
    () =>
      materials.length > 0
        ? afterColour.filter((v) => VariantModel.getMaterialOption(v) === resolvedMaterial)
        : afterColour,
    [afterColour, materials, resolvedMaterial],
  );

  // Axis 3: Size
  const sizes = useMemo(
    () =>
      unique(afterMaterial.map((v) => VariantModel.getSizeOption(v)).filter(Boolean) as string[]),
    [afterMaterial],
  );

  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  /**
   * A variant is considered "fully selected" only when every axis that exists
   * for this product has a value chosen.  For size we require an explicit user
   * selection (ring/necklace sizing is intentional); colour and material auto-
   * resolve to the first available option.
   */
  const selectedVariant = useMemo((): Variant | null => {
    const needsSize = sizes.length > 0;
    if (needsSize && !sizes.includes(selectedSize ?? "")) return null;

    const candidates = afterMaterial.filter((v) => {
      if (needsSize && VariantModel.getSizeOption(v) !== selectedSize) return false;
      return true;
    });

    if (candidates.length === 1) return candidates[0];
    if (candidates.length === 0) return null;

    // More than one candidate means the current selections do not fully
    // narrow to a single variant.  This should not normally happen if the
    // product data is well-formed — log it so it surfaces during development.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[useVariantSelector] Multiple variants match the current selection.",
        {resolvedColour, resolvedMaterial, selectedSize, candidates},
      );
    }
    return null;
  }, [afterMaterial, sizes, selectedSize, resolvedColour, resolvedMaterial]);

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    product: {
      id: product?.id,
      title: product?.title,
      handle: product?.handle,
    },
    /** All distinct colour values available across in-stock variants. */
    colours,
    /** All distinct material values available given the selected colour. */
    materials,
    /** All distinct size values available given the selected colour + material. */
    sizes,

    /** The single variant that matches all current selections, or null. */
    selectedVariant,

    /**
     * The variants that survive the colour + material filter.  Useful for
     * reading shared attributes like image or price range before a size is
     * chosen.
     */
    filteredVariants: afterMaterial,

    filter: {
      colour: resolvedColour,
      material: resolvedMaterial,
      size: selectedSize,
    },

    setFilter: {
      colour: (value: string) => {
        setSelectedColour(value);
        // Reset downstream selections when the colour changes so the user
        // consciously re-picks material and size for the new colour.
        setSelectedMaterial(null);
        setSelectedSize(null);
      },
      material: (value: string) => {
        setSelectedMaterial(value);
        setSelectedSize(null);
      },
      size: setSelectedSize,
    },
  };
}