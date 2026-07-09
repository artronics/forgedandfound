import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";
import {cn} from "@/lib/utils";

export type SwatchColour = "default" | "yellow" | "silver" | "rose" | "white";

const swatchVariants = cva(
  "shrink-0 outline-transparent hover:ring-1 hover:ring-border cursor-pointer transition-all",
  {
    variants: {
      variant: {
        default: "bg-destructive",
        yellow: "bg-metal-yellow",
        silver: "bg-metal-silver",
        rose: "bg-metal-rose",
        white: "bg-metal-white",
      },
    },
  },
);

interface SwatchProps extends React.ComponentProps<"button">, VariantProps<typeof swatchVariants> {
  selected?: boolean;
}

export function SwatchItem(
  {
    className,
    variant,
    selected,
    ...props
  }: SwatchProps) {
  return (
    <button
      data-slot="swatch-item"
      data-variant={variant}
      className={cn(
        "outline-1 outline-offset-2 m-1 md:outline-1",
        "size-6 rounded-lg md:size-8",
        "group-data-[size=sm]/swatch:size-6 group-data-[size=sm]/swatch:rounded-full",
        swatchVariants({variant, className}),
        selected && ["outline-primary", "hover:ring-0"])}
      {...props}
    />
  );
}

export function SwatchGroup(
  {
    className,
    size = "default",
    ...props
  }: React.ComponentProps<"div"> & { size?: "default" | "sm" },
) {
  return (
    <div
      data-slot="swatch"
      data-size={size}
      className={cn(
        "group/swatch gap-2 md:gap-2 flex",
        className,
      )}
      {...props}
    />
  );
}
