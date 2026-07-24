import React from "react";
import {SwatchColour, SwatchItem} from "@/components/ui/swatch";
import {Finish} from "@/lib/product/variant";
import {cn} from "@/lib/utils";

// One finish → one swatch. The colour comes from our CSS metal palette keyed by
// the colour metaobject's *handle* — Shopify is the source of what a finish is,
// the frontend is the source of how it looks. A colour carrying an image
// (two-tone, textured metals) renders the image instead of a flat colour.

const SWATCH_FOR_COLOUR: Record<string, SwatchColour> = {
  "yellow-gold": "yellow",
  "white-gold": "white",
  "rose-gold": "rose",
  "silver": "silver",
};

/** Fallback for unresolved finishes, where only a raw option string exists. */
function sniffColour(label: string | null): SwatchColour {
  const s = (label ?? "").toLowerCase();
  if (s.includes("white")) return "white";
  if (s.includes("rose")) return "rose";
  if (s.includes("silver")) return "silver";
  if (s.includes("gold") || s.includes("yellow")) return "yellow";
  return "default";
}

export function FinishSwatch({finish, label, outOfStock, selected, onSelect}: {
  finish: Finish | null;
  /** Display fallback when the finish did not resolve to a metaobject. */
  label: string | null;
  outOfStock?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const image = finish?.colour?.image ?? null;
  const variant = finish?.colour
    ? SWATCH_FOR_COLOUR[finish.colour.handle] ?? "default"
    : sniffColour(finish?.label ?? label);

  return (
    <SwatchItem
      variant={variant}
      onClick={onSelect}
      selected={selected}
      title={finish?.label ?? label ?? undefined}
      aria-label={finish?.label ?? label ?? undefined}
      className={cn(outOfStock && "opacity-40", image && "bg-cover bg-center")}
      style={image ? {backgroundImage: `url(${image.url})`} : undefined}
    />
  );
}
