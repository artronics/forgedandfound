import {Icon} from "@/components/ui/icon";
import React from "react";
import {useCartSheet} from "@/lib/cart/useCartSheet";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {Badge} from "@/components/ui/badge";

export function CartButton({cartCount}: { cartCount: number }) {
  const {setOpen} = useCartSheet();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setOpen(true)}
      aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
      className={cn("relative")}
    >
      <Icon icon="shopping-bag"/>
      {cartCount > 0 && (
        <Badge
          variant="indicator"
          className={cn(
            "absolute bottom-4 left-4 size-4 lg:size-4.5",
          )}>
          {cartCount > 9 ? "9+" : cartCount}
        </Badge>
      )}
    </Button>
  );
}

