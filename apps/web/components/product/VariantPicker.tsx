"use client";

import React from "react";
import {Label} from "@/components/ui/label";
import {OptionGroup, OptionItem} from "@/components/ui/option";
import {SwatchGroup} from "@/components/ui/swatch";
import {FinishSwatch} from "@/components/product/FinishSwatch";
import {AxisChoice} from "@/lib/product/useVariantSelector";
import {cn} from "@/lib/utils";

// The two axis rows every selector surface composes (PDP card, quick add,
// product card). All selection logic lives in useVariantSelector — these only
// render choices, so the three surfaces can differ visually without forking
// any behaviour.
//
// Out-of-stock values stay visible and clickable (dimmed / struck through):
// selecting one is how "Notify me" will be reached, and the clicks are worth
// analytics either way.

export function FinishPicker({choices, selected, onSelect, title, size}: {
  choices: AxisChoice[];
  selected: string | null;
  onSelect: (key: string) => void;
  /** Row heading; omit for reduced surfaces (product cards). */
  title?: string;
  size?: "default" | "sm";
}) {
  if (choices.length < 2) return null;
  return (
    <div>
      {title && <Label variant="field" className="pb-1">{title}</Label>}
      <SwatchGroup size={size}>
        {choices.map((choice) => (
          <FinishSwatch
            key={choice.key}
            finish={choice.variant.finish}
            label={choice.label}
            outOfStock={choice.availability === "OUT_OF_STOCK"}
            selected={selected === choice.key}
            onSelect={() => onSelect(choice.key)}
          />
        ))}
      </SwatchGroup>
    </div>
  );
}

export function SizePicker({choices, selected, onSelect, title}: {
  choices: AxisChoice[];
  selected: string | null;
  onSelect: (key: string) => void;
  title?: string;
}) {
  if (choices.length === 0) return null;
  return (
    <div>
      {title && <Label variant="field">{title}</Label>}
      <OptionGroup className="pt-1">
        {choices.map((choice) => (
          <OptionItem
            key={choice.key}
            onClick={() => onSelect(choice.key)}
            selected={selected === choice.key}
            className={cn(choice.availability === "OUT_OF_STOCK" && "opacity-40 line-through")}
          >
            {choice.label}
          </OptionItem>
        ))}
      </OptionGroup>
    </div>
  );
}
