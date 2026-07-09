import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";
import {cn} from "@/lib/utils";

const optionVariants = cva(
  "border border-border/40 cursor-pointer hover:border-primary transition-all",
  {
    variants: {
      variant: {
        default: "",
      },
      size: {
        default: "text-xs py-2 px-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

interface SizeProps extends React.ComponentProps<"button">, VariantProps<typeof optionVariants> {
  selected?: boolean;
}

export function OptionItem(
  {
    className,
    variant,
    selected,
    size = "default",
    ...props
  }: SizeProps) {
  return (
    <button
      data-slot="option-item"
      data-variant={variant}
      data-size={size}
      className={cn(
        "flex-inline",
        "shink-0 max-w-sm mx-auto w-full uppercase tracking-widest text-muted-foreground",
        optionVariants({variant, size: size, className}),
        selected && ["border-primary", "bg-primary-foreground"])}
      {...props}
    />
  );
}

export function OptionGroup(
  {
    className,
    ...props
  }: React.ComponentProps<"div"> & { children: React.ReactNode }) {
  return (
    <div
      data-slot="option-group"
      {...props}
      className={cn(
        "grid grid-cols-1 md:justify-start md:grid-cols-[repeat(auto-fit,minmax(8em,auto))] gap-4",
        className,
      )}
    />
  );
}
