import React from "react";
import {cn} from "@/lib/utils";

export function Surface(
  {
    className,
    ...props
  }: React.ComponentProps<"div"> & { children: React.ReactNode }) {
  return (
    <div
      data-slot="surface"
      className={cn(
        "flex flex-col bg-surface-container border border-sm border-card p-10 gap-6 max-w-md",
        className,
      )}
      {...props}
    />
  );
}

export function CartSummary() {
}