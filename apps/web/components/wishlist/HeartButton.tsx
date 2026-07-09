import {Button} from "@/components/ui/button";
import React from "react";
import {cva, type VariantProps} from "class-variance-authority";
import {cn} from "@/lib/utils";
import {Icon} from "@/components/ui/icon";

type HeartButtonProps = React.ComponentPropsWithoutRef<typeof Button> & VariantProps<typeof buttonVariants> & {
  active?: boolean
};

const buttonVariants = cva(
  "transition-colors",
  {
    variants: {
      variant: {
        default: "text-xl",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export const HeartButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  HeartButtonProps
>(({children, active = false, variant, className, ...props}, ref) => {
  return (
    <Button
      ref={ref}
      variant={active ? "ghost" : "default"}
      className={cn(buttonVariants({
        variant,
        className,
      }))}
      {...props}
    >
      <Icon
        icon="heart"
        className={cn(active ? "fill-current text-primary" : "fill-current text-primary-foreground hover:text-foreground")}/>
    </Button>
  );
});

HeartButton.displayName = "HeartButton";