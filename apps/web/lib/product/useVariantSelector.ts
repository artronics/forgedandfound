"use client";
import {useMemo, useState} from "react";
import {VariantSelector_ProductFragmentDoc} from "@/graphql/generated/graphql";
import {FragmentType, useFragment} from "@/graphql/generated";
import {Availability, toVariant, Variant} from "@/lib/product/variant";

// Drives every variant selector surface (PDP, quick add, product card).
//
// Selection is a *coordinate* — {finish, size} — over the product's variant
// tuples, not a cascade of filters. Both axes are derived from ALL variants on
// every render: no value is ever hidden because of the other selection, and
// nothing is filtered out for being out of stock (out-of-stock combinations
// render dimmed — they feed "Notify me" and analytics). A value that conflicts
// with the other axis stays clickable; choosing it keeps the click and repairs
// the other axis instead.

type UseVariantSelectorProps = {
  fragment: FragmentType<typeof VariantSelector_ProductFragmentDoc> | null;
  /** Pre-select a finish (quick add from a card's swatch, or a shared URL). */
  initialFinish?: string | null;
  /** Pre-select a size (a shared URL). */
  initialSize?: string | null;
};

export interface AxisChoice {
  key: string;
  label: string;
  /**
   * Availability of this value *given the other axis's selection* — what the
   * user would land on by clicking it. "OUT_OF_STOCK" also covers combinations
   * that don't exist as variants.
   */
  availability: Availability;
  /** The variant this choice would land on (for swatch colour/image reads). */
  variant: Variant;
}

type Selection = {finish: string | null; size: string | null};

const rank: Record<Availability, number> = {AVAILABLE: 0, BACKORDER: 1, OUT_OF_STOCK: 2};

/** Distinct axis values in first-seen order, each scored against the variants
 * that would remain if it were selected alongside `others`. */
function axisChoices(
  variants: Variant[],
  key: (v: Variant) => string | null,
  label: (v: Variant) => string | null,
  matchesOthers: (v: Variant) => boolean,
): AxisChoice[] {
  const choices = new Map<string, AxisChoice>();
  for (const v of variants) {
    const k = key(v);
    if (k == null) continue;
    const relevant = matchesOthers(v);
    const existing = choices.get(k);
    if (!existing) {
      choices.set(k, {
        key: k,
        label: label(v) ?? k,
        availability: relevant ? v.availability : "OUT_OF_STOCK",
        variant: v,
      });
    } else if (relevant && rank[v.availability] < rank[existing.availability]) {
      // A better variant exists for this value under the current selection.
      choices.set(k, {...existing, availability: v.availability, variant: v});
    }
  }
  return [...choices.values()];
}

export function useVariantSelector({fragment, initialFinish, initialSize}: UseVariantSelectorProps) {
  const product = useFragment(VariantSelector_ProductFragmentDoc, fragment);

  const variants: Variant[] = useMemo(
    () => product?.variants.edges.map((e) => toVariant(e.node)) ?? [],
    [product],
  );

  const [selection, setSelection] = useState<Selection>(() => ({
    finish: initialFinish ?? null,
    size: initialSize ?? null,
  }));

  const hasFinishAxis = variants.some((v) => v.finishKey != null);
  const hasSizeAxis = variants.some((v) => v.sizeKey != null);

  // Resolve the selection against what actually exists: a stale or absent
  // finish falls back to the first in-stock finish (a product card should
  // present something buyable); size stays an explicit user choice.
  const selectedFinish = useMemo(() => {
    if (!hasFinishAxis) return null;
    const keys = variants.map((v) => v.finishKey);
    if (selection.finish != null && keys.includes(selection.finish)) return selection.finish;
    const firstAvailable = variants.find((v) => v.availability === "AVAILABLE" && v.finishKey != null);
    return firstAvailable?.finishKey ?? variants[0]?.finishKey ?? null;
  }, [variants, hasFinishAxis, selection.finish]);

  const selectedSize =
    hasSizeAxis && selection.size != null && variants.some((v) => v.sizeKey === selection.size)
      ? selection.size
      : null;

  const finishes = useMemo(
    () =>
      axisChoices(
        variants,
        (v) => v.finishKey,
        (v) => v.finishLabel,
        (v) => selectedSize == null || v.sizeKey === selectedSize,
      ),
    [variants, selectedSize],
  );

  const sizes = useMemo(
    () =>
      axisChoices(
        variants,
        (v) => v.sizeKey,
        (v) => v.sizeLabel,
        (v) => selectedFinish == null || v.finishKey === selectedFinish,
      ).sort((a, b) => (a.variant.size?.sortOrder ?? 0) - (b.variant.size?.sortOrder ?? 0)),
    [variants, selectedFinish],
  );

  /** The exact tuple the selection names, regardless of stock (out-of-stock
   * still selects — the button disables and "Notify me" takes over later). */
  const selectedVariant = useMemo((): Variant | null => {
    if (hasSizeAxis && selectedSize == null) return null;
    return (
      variants.find(
        (v) =>
          (!hasFinishAxis || v.finishKey === selectedFinish) &&
          (!hasSizeAxis || v.sizeKey === selectedSize),
      ) ?? null
    );
  }, [variants, hasFinishAxis, hasSizeAxis, selectedFinish, selectedSize]);

  /** What the surface displays before the selection is complete: the selected
   * variant, else the first variant of the selected finish, else the first. */
  const displayVariant = useMemo(
    (): Variant | null =>
      selectedVariant ??
      variants.find((v) => selectedFinish == null || v.finishKey === selectedFinish) ??
      variants[0] ??
      null,
    [selectedVariant, variants, selectedFinish],
  );

  const exists = (finish: string | null, size: string | null) =>
    variants.some(
      (v) =>
        (finish == null || v.finishKey === finish) && (size == null || v.sizeKey === size),
    );

  // The clicked axis always wins; the other is cleared only when the resulting
  // tuple does not exist at all (never merely because it is out of stock).
  const select = {
    finish: (key: string) =>
      setSelection((s) => ({finish: key, size: s.size != null && exists(key, s.size) ? s.size : null})),
    size: (key: string) =>
      setSelection((s) => ({
        finish: s.finish != null && !exists(s.finish, key) ? null : s.finish,
        size: key,
      })),
  };

  return {
    product: {
      id: product?.id,
      title: product?.title,
      handle: product?.handle,
    },
    /** Every finish the product comes in, scored against the selected size. */
    finishes,
    /** Every size the product comes in (sort_order), scored against the selected finish. */
    sizes,
    selected: {finish: selectedFinish, size: selectedSize},
    select,
    /** The exact variant the selection names (may be out of stock), or null. */
    selectedVariant,
    /** The variant to read image/price/label from while selection is partial. */
    displayVariant,
    variants,
  };
}
