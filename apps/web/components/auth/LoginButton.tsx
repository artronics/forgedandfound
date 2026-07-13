import * as React from "react";
import {cva, type VariantProps} from "class-variance-authority";

import {cn} from "@/lib/utils";
import {Icon} from "@/components/ui/icon";

const loginButtonVariants = cva(
  "relative inline-flex h-11 w-full items-center justify-center rounded-none border font-medium transition-all outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary text-primary-foreground hover:opacity-90",
        default:
          "border-border bg-background text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-9 text-xs",
        md: "h-11 text-sm",
        lg: "h-12 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);
export type LoginProvider = "email" | "google" | "apple" | "facebook";

type ProviderConfig = {
  label: string;
  icon: React.ReactNode;
  variant: NonNullable<
    VariantProps<typeof loginButtonVariants>["variant"]
  >;
};

const PROVIDERS: Record<LoginProvider, ProviderConfig> = {
  google: {
    label: "Sign in with Google",
    variant: "default",
    icon: <GoogleMark className="size-5"/>,
  },

  facebook: {
    label: "Sign in with Facebook",
    variant: "default",
    icon: <FacebookMark className="size-5"/>,
  },

  apple: {
    label: "Sign in with Apple",
    variant: "default",
    icon: <AppleMark className="size-5.5"/>,
  },

  email: {
    label: "Sign in",
    variant: "primary",
    icon: <Icon icon="log-in" className="size-5"/>,
  },
};

export type LoginButtonProps = React.ComponentProps<"button"> &
  Omit<VariantProps<typeof loginButtonVariants>, "variant"> & {
  provider: LoginProvider;
  variant?: VariantProps<typeof loginButtonVariants>["variant"];
};

export function LoginButton(
  {
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
        "relative",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="
          absolute
          left-6
          top-1/2
          -translate-y-1/2
          flex
          h-6
          w-6
          items-center
          justify-center
          pointer-events-none
        "
      >
        {config.icon}
      </span>

      <span className="block w-full text-center">
        {children ?? config.label}
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
    <svg viewBox="0 0 24 24" className={className} {...props}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
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
      <path
        transform="translate(12 12) scale(0.9) translate(-12 -12)"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

function FacebookMark({
                        className,
                        ...props
                      }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 14222 14222"
      className={className}
      {...props}
    >
      <path
        fill="#1977F3"
        d="M14222 7111c0-3927-3184-7111-7111-7111S0 3184 0 7111c0 3549 2600 6491 6000 7025v-4969H4194V6111h1806V4544c0-1782 1062-2767 2686-2767 778 0 1592 139 1592 139v1750h-897c-883 0-1159 548-1159 1111v1334h1972l-315 2056h-1657v4969c3400-533 6000-3475 6000-7025z"
      />
      <path
        fill="#FEFEFE"
        d="M9879 9167l315-2056h-1972v-1334c0-562 275-1111 1159-1111h897v-1750s-814-139-1592-139c-1624 0-2686 984-2686 2767v1567H4194v2056h1806v4969c362 57 733 86 1111 86s749-30 1111-86v-4969h1657z"
      />
    </svg>
  );
}