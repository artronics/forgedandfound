import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";
import {cn} from "@/lib/utils";

const labelVariants = cva("", {
  variants: {
    variant: {
      default: "",
      eyebrow: "tracking-widest uppercase",
      title: "font-serif tracking-tight capitalize",
      label: "text-muted-foreground tracking-widest uppercase",
    },
  },
});

export function Text(
  {
    className,
    variant = "default",
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement> & VariantProps<typeof labelVariants>) {
  return (
    <div
      data-slot={`text-${variant}`}
      className={cn(
        labelVariants({variant}),
        className,
      )}
      {...props} />
  );
}

const priceVariants = cva("tracking-tight tabular-nums", {
  variants: {
    state: {
      default: "",
      sale: "text-secondary",
      disabled: "opacity-40 line-through",
    },
  },
});

interface PriceProps extends VariantProps<typeof priceVariants>, React.HTMLAttributes<HTMLSpanElement> {
}

function PriceLabel({className, state, ...props}: PriceProps) {
  return (
    <span className={cn(priceVariants({state, className}))} {...props} />
  );
}

export function Price({price, compareAtPrice, className, size = "md"}: {
  price: string,
  compareAtPrice?: string,
  className?: string,
  size?: "xs" | "sm" | "md" | "lg"
}) {
  return (
    <div
      data-size={size}
      className={cn(
        "flex items-baseline font-serif",
        size === "xs" && "text-sm",
        size === "sm" && "text-lg",
        size === "md" && "text-xl",
        size === "lg" && "text-2xl",
        className)}
    >
      <PriceLabel
        className={cn("")}
        state={compareAtPrice ? "sale" : "default"}>{price}</PriceLabel>
      <PriceLabel className="text-[85%] pl-2" state="disabled">{compareAtPrice}</PriceLabel>
    </div>
  );
}
