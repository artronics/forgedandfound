"use client";

import React from "react";
import {cn} from "@/lib/utils";
import {BrandLogo} from "@/components/brand";
import {Button} from "@/components/ui/button";

/**
 * Placeholder for the animated brand logo shown while a page loads.
 * TODO(design): replace with the real logo animation.
 */
export function LogoAnimation({className}: { className?: string }) {
  return (
    <div className={cn("animate-pulse text-foreground", className)} aria-hidden>
      <BrandLogo size={64}/>
    </div>
  );
}

/**
 * Full-screen overlay shown while a page's data is loading.
 * Used by route-level loading.tsx files and by QueryGate for
 * client-fetched pages.
 */
export function LoadingOverlay() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <LogoAnimation/>
    </div>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

/**
 * Consistent full-page error state. Route-level error.tsx files and
 * client-fetched pages both render this.
 */
export function ErrorState(
  {
    title = "Something went wrong",
    message = "We couldn't load this page. Please try again, or come back later.",
    onRetry,
  }: ErrorStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <LogoAnimation className="animate-none opacity-40"/>
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}

type QueryGateProps = {
  /** Show the loading overlay. Pass `loading && !data` to keep stale data visible while refetching. */
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
};

/**
 * Standard loading/error gate for pages that fetch on the client
 * (collection, search, wishlist). Server-rendered pages get the same
 * treatment from loading.tsx / error.tsx instead.
 */
export function QueryGate({loading, error, onRetry, children}: QueryGateProps) {
  if (error) return <ErrorState onRetry={onRetry}/>;
  if (loading) return <LoadingOverlay/>;
  return <>{children}</>;
}
