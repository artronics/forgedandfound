import {SwatchColour, SwatchItem} from "@/components/ui/swatch";
import React from "react";

export function FinishSwatch({colour, selected, onSelect}: {
  colour: string,
  selected: boolean,
  onSelect: () => void
}) {
  return (
    <SwatchItem variant={colourToSwatch(colour)} onClick={onSelect} selected={selected}/>
  );
}

function colourToSwatch(colour: string): SwatchColour {
  const raw = colour.toLowerCase().trim();
  if (raw.includes("white")) return "white";
  if (raw.includes("rose") || raw.includes("red")) return "rose";
  if (raw.includes("silver")) return "silver";
  if (raw.includes("gold") || raw.includes("yellow")) return "yellow";
  return "default";
}

