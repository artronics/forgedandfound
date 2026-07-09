"use client";

import * as React from "react";
import {Label as LabelPrimitive} from "radix-ui";
import {cva, VariantProps} from "class-variance-authority";
import {cn} from "@/lib/utils";

const labelVariants = cva(
  "flex items-center gap-2 leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50", {
    variants: {
      variant: {
        default: "uppercase tracking-[0.12em]",
        field: "text-2xs text-card-foreground",
        option: "capitalize tracking-wide text-sm text-muted-foreground cursor-pointer",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Label(
  {
    className,
    variant = "default",
    ...props
  }: React.ComponentProps<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        labelVariants({variant}),
        className,
      )}
      {...props}
    />
  );
}

export {Label};
