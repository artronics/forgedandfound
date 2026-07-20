"use client";
import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  createLucideIcon,
  Expand,
  Heart, LogIn,
  Loader2,
  LogOut,
  type LucideIcon,
  type LucideProps,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";

// ─── Custom (non-lucide) glyphs ─────────────────────────────────────────────

const Paypal = createLucideIcon("Paypal", [
  ["path", {
    d: "M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z",
    fill: "currentColor",
    stroke: "none",
    transform: "scale(0.8532)",
    key: "Paypal",
  }],
]);
const Apple = createLucideIcon("Apple", [
  ["path", {
    d: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701",
    fill: "currentColor",
    stroke: "none",
    transform: "scale(0.8832), translate(0, -0.5)",
    key: "Apple",
  }],
]);
const CreditCard = createLucideIcon("CreditCard", [
  ["path", {
    d: "M19 1.80768V13.1922C19 13.6974 18.8251 14.1249 18.4751 14.4749C18.1251 14.8249 17.6975 14.9999 17.1924 14.9999H1.8078C1.30268 14.9999 0.875114 14.8249 0.525118 14.4749C0.175121 14.1249 0.00012207 13.6974 0.00012207 13.1922V1.80768C0.00012207 1.30255 0.175121 0.874992 0.525118 0.524995C0.875114 0.174998 1.30268 0 1.8078 0H17.1924C17.6975 0 18.1251 0.174998 18.4751 0.524995C18.8251 0.874992 19 1.30255 19 1.80768V1.80768M1.50009 3.90384H17.5001V1.80768C17.5001 1.73075 17.468 1.66023 17.4039 1.59612C17.3398 1.53202 17.2693 1.49996 17.1924 1.49996H1.8078C1.73087 1.49996 1.66035 1.53202 1.59625 1.59612C1.53214 1.66023 1.50009 1.73075 1.50009 1.80768V3.90384V3.90384M1.50009 7.09609V13.1922C1.50009 13.2692 1.53214 13.3397 1.59625 13.4038C1.66035 13.4679 1.73087 13.5 1.8078 13.5H17.1924C17.2693 13.5 17.3398 13.4679 17.4039 13.4038C17.468 13.3397 17.5001 13.2692 17.5001 13.1922V7.09609H1.50009V7.09609M1.50009 13.5V13.5C1.50009 13.5 1.50009 13.4711 1.50009 13.4134C1.50009 13.3557 1.50009 13.282 1.50009 13.1922V1.80768C1.50009 1.71793 1.50009 1.6442 1.50009 1.58651C1.50009 1.52881 1.50009 1.49996 1.50009 1.49996V1.49996C1.50009 1.49996 1.50009 1.52881 1.50009 1.58651C1.50009 1.6442 1.50009 1.71793 1.50009 1.80768V13.1922C1.50009 13.282 1.50009 13.3557 1.50009 13.4134C1.50009 13.4711 1.50009 13.5 1.50009 13.5V13.5",
    fill: "currentColor",
    stroke: "none",
    transform: "scale(1.2632)",
    key: "CreditCard",
  }],
]);

// ─── Registry ───────────────────────────────────────────────────────────────
// Keyed by what the glyph *is*, not by where it's used.

const icons = {
  "arrow-right": ArrowRight,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  expand: Expand,
  heart: Heart,
  loader: Loader2,
  "log-out": LogOut,
  "log-in": LogIn,
  menu: Menu,
  minus: Minus,
  plus: Plus,
  search: Search,
  "shopping-bag": ShoppingBag,
  "sliders-horizontal": SlidersHorizontal,
  user: User,
  x: X,
  apple: Apple,
  "credit-card": CreditCard,
  paypal: Paypal,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

// ─── Variants ─────────────────────────────────────────────────────────────
// `auto` (default) scales with the surrounding font-size (`size-[1em]`), so
// `text-sm`/`text-lg` on a parent flows through. When the icon sits inside a
// <Button>, it reads the button's `data-size` (via the `group/button` set in
// buttonVariants) and snaps to a size that matches that button.
// `weight` maps to the SVG stroke-width; a CSS rule beats lucide's default
// stroke-width attribute. Pass `strokeWidth` directly for one-off values.

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      auto:
        "size-[1em] group-data-[size=icon-xs]/button:size-3.5 group-data-[size=icon-sm]/button:size-4 group-data-[size=icon]/button:size-5 group-data-[size=icon-lg]/button:size-6",
      sm: "size-4",
      md: "size-6",
      lg: "size-8",
    },
    weight: {
      thin: "[stroke-width:1]",
      regular: "[stroke-width:1.5]",
      bold: "[stroke-width:2]",
    },
  },
  defaultVariants: {
    size: "auto",
  },
});

export type IconProps = Omit<LucideProps, "ref"> &
  VariantProps<typeof iconVariants> & {
  icon: IconName;
};

export function Icon({icon, size, weight, className, ...props}: IconProps) {
  const Glyph = icons[icon];
  return (
    <Glyph
      className={cn(iconVariants({size, weight}), className)}
      {...props}
    />
  );
}

// ─── IconButton ─────────────────────────────────────────────────────────────
// A Button that holds a single glyph. Defaults to the `icon` size so it lines
// up with text buttons; pass any Button `size`/`variant` to change that.
// `children` (e.g. an sr-only label) render after the glyph.

export type IconButtonProps = React.ComponentProps<typeof Button> & {
  icon: IconName;
  weight?: VariantProps<typeof iconVariants>["weight"];
  strokeWidth?: number;
  iconClassName?: string;
};

export function IconButton(
  {
    icon,
    weight,
    strokeWidth,
    iconClassName,
    size = "icon",
    children,
    ...props
  }: IconButtonProps) {
  return (
    <Button size={size} {...props}>
      <Icon icon={icon} weight={weight} strokeWidth={strokeWidth} className={iconClassName}/>
      {children}
    </Button>
  );
}
