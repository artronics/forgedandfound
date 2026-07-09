import React from "react";
import {cn} from "@/lib/utils";

export function ItemImage({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div className={cn(
      "md:row-span-2 aspect-square min-w-34",
      className,
    )}
         {...props}
    />
  );
}

export function ItemContent({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div className={cn(
      "flex flex-col space-y-4 pt-8 md:pt-0",
      className,
    )}
         {...props}
    />
  );
}

export function ItemFooter({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div className={cn(
      "flex items-center",
      className,
    )}
         {...props}
    />
  );
}

export function Item({className, ...props}: React.ComponentProps<"div">) {
  return (
    <div className={cn(
      "grid grid-cols-1 md:grid-cols-[auto_1fr] md:grid-rows-[1fr_auto]",
      className,
    )}
         {...props}
    />
  );
}