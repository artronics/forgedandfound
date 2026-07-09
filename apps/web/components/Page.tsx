import React from "react";
import {cn} from "@/lib/utils";

export function Page(
  {
    className,
    size = "default",
    ...props
  }: React.ComponentProps<"div"> & { children: React.ReactNode, size?: "default" | "md" }) {
  return (
    <div
      data-slot="page"
      data-size={size}
      className={cn(
        "group/page flex flex-col px-4 md:px-8 lg:px-12 py-8 md:py-12 lg:py-16 gap-8 md:gap-12 lg:gap-16",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-2 lg:gap-4",
        "[&>h2]:text-2xl lg:[&>h2]:text-3xl [&>h2]:font-serif [&>h2]:capitalize [&>h2]:tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function PageContent({className, ...props}: React.ComponentProps<"div">) {
  return (
    <section
      className={cn(
        "flex flex-col w-full gap-8 lg:gap-12 xl:gap-16",
        className,
      )}
      {...props}
    />
  );
}
