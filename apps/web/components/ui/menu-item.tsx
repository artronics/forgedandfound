import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";
import {Slot} from "radix-ui";
import {cn} from "@/lib/utils";

const menuItemVariants = cva(
  [
    "group flex items-center gap-2 py-1 w-full",
    "cursor-pointer select-none outline-none",
    "transition-colors duration-150",
    "not-data-[disabled]:hover:font-semibold",
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
  ],
  {
    variants: {
      variant: {
        default: "text-left text-sm",
        nav: "text-sm text-muted-foreground hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface MenuItemProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof menuItemVariants> {
  icon?: React.ReactNode;
  disabled?: boolean;
  asChild?: boolean;
}

export function MenuItem({
                           className,
                           variant,
                           icon,
                           disabled,
                           asChild = false,
                           children,
                           ...props
                         }: MenuItemProps) {
  const Comp = asChild ? Slot.Root : "div";

  return (
    <Comp
      data-slot="menu-item"
      data-disabled={disabled ? "" : undefined}
      aria-disabled={disabled || undefined}
      className={cn(menuItemVariants({variant, className}))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <span className="flex-1">{children}</span>
        </>
      )}
    </Comp>
  );
}
