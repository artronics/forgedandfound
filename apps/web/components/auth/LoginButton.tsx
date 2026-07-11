import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

const loginButtonVariants = cva(
  "group inline-flex w-full shrink-0 cursor-pointer items-center justify-center rounded-none border font-medium normal-case tracking-normal transition-all outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary text-primary-foreground hover:opacity-90",
        default:
          "border-border bg-background text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-9 text-xs [&_svg]:size-4",
        md: "h-11 text-sm [&_svg]:size-5",
        lg: "h-12 text-base [&_svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export type LoginProvider = "email" | "google" | "apple";

type ProviderConfig = {
  label: string;
  icon: React.ReactNode;
  variant: NonNullable<
    VariantProps<typeof loginButtonVariants>["variant"]
  >;
};

const iconWrapper =
  "flex h-5 w-5 items-center justify-center";

const PROVIDERS: Record<LoginProvider, ProviderConfig> = {
  email: {
    label: "Sign in with Email",
    variant: "primary",
    icon: (
      <span className={iconWrapper}>
        <Icon icon="log-in" className="h-5 w-5" aria-hidden />
      </span>
    ),
  },

  google: {
    label: "Sign in with Google",
    variant: "default",
    icon: (
      <span className={iconWrapper}>
        <GoogleMark className="h-5 w-5" aria-hidden />
      </span>
    ),
  },

  apple: {
    label: "Sign in with Apple",
    variant: "default",
    icon: (
      <span className={iconWrapper}>
        {/* Slightly larger for optical balance */}
        <AppleMark className="h-[22px] w-[22px]" aria-hidden />
      </span>
    ),
  },
};

export type LoginButtonProps = React.ComponentProps<"button"> &
  Omit<VariantProps<typeof loginButtonVariants>, "variant"> & {
    provider: LoginProvider;
    variant?: VariantProps<typeof loginButtonVariants>["variant"];
  };

export function LoginButton({
  provider,
  variant,
  size,
  className,
  children,
  ...props
}: LoginButtonProps) {
  const config = PROVIDERS[provider];

  return (
    <button
      data-provider={provider}
      className={cn(
        loginButtonVariants({
          variant: variant ?? config.variant,
          size,
        }),
        className,
      )}
      {...props}
    >
      <span className="grid w-full grid-cols-[2.75rem_1fr_2.75rem] items-center">
        {/* Icon column */}
        <span className="flex justify-center">
          {config.icon}
        </span>

        {/* Perfectly centred label */}
        <span className="text-center">
          {children ?? config.label}
        </span>

        {/* Empty column balances the icon column */}
        <span aria-hidden />
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Brand marks
// ─────────────────────────────────────────────────────────────

function GoogleMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleMark({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}