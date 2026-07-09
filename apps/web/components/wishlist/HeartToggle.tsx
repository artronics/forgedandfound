import React from "react";
import {Icon} from "@/components/ui/icon";
import {Toggle} from "@/components/ui/toggle";
import {cn} from "@/lib/utils";

export function HeartToggle({className, ...props}: React.ComponentProps<typeof Toggle>) {
  return (
    <Toggle {...props} className={cn("rounded-none bg-background/40 hover:bg-background/60 data-[state=on]:bg-background/75", className)} aria-label="Toggle wishlist" size="lg">
      <Icon size="md" weight="thin" icon="heart" className="group-data-[state=on]/toggle:fill-primary group-data-[state=on]/toggle:text-primary"/>
    </Toggle>
  );

}