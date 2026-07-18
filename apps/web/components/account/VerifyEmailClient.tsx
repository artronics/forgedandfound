"use client";

import React, {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {signOut} from "next-auth/react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";

type Status =
  | "verifying"
  | "changed"
  | "merged"
  | "signin-required"
  | "wrong-account"
  | "error"
  | "invalid";

/**
 * Completes an email change or account merge from the emailed signed token.
 * The backend requires an authenticated session matching the token, so:
 * - no session → send the user to sign in and come back here;
 * - wrong account (merge approval, or a change link opened under another
 *   session) → explain and offer to switch accounts;
 * - change confirmed → refresh the session so the new email shows immediately;
 * - merge confirmed → the old session references a removed account, so sign
 *   out and prompt a fresh sign-in.
 */
export default function VerifyEmailClient({token}: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(token ? "verifying" : "invalid");
  const [error, setError] = useState<string | null>(null);
  // React 18 Strict Mode mounts effects twice in dev; guard so we only confirm once.
  const startedRef = useRef(false);

  const selfUrl = `/account/verify-email?token=${encodeURIComponent(token)}`;
  const loginUrl = `/account/login?next=${encodeURIComponent(selfUrl)}`;

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/account/verify", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({token}),
        });

        if (res.status === 401) {
          setStatus("signin-required");
          return;
        }

        const data = await res.json().catch(() => ({}));

        if (res.status === 403 && data.code === "WRONG_ACCOUNT") {
          setError(data.error ?? null);
          setStatus("wrong-account");
          return;
        }
        if (!res.ok) {
          setError(data.error ?? "We couldn't verify your email. Please try again.");
          setStatus("error");
          return;
        }

        if (data.merged) {
          // The session's account was merged away — a fresh sign-in lands on
          // the surviving account with all sign-in methods attached.
          await signOut({redirect: false});
          setStatus("merged");
          return;
        }

        // Email changed: pull the new attributes into the session right away.
        await fetch("/api/auth/refresh-session", {method: "POST"}).catch(() => {});
        router.refresh();
        setStatus("changed");
      } catch {
        setError("Something went wrong. Please try again.");
        setStatus("error");
      }
    })();
  }, [token, router]);

  const switchAccount = async () => {
    await signOut({redirect: false});
    router.push(loginUrl);
  };

  return (
    <Card className="mx-auto max-w-md bg-surface-container px-4">
      <CardHeader className="px-0 pt-8 pb-0">
        <CardTitle className="text-center pb-4">Verify your email</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pt-6 pb-8">
        {status === "verifying" && (
          <div className="flex flex-col items-center gap-4 text-center py-2">
            <Icon icon="loader" className="size-6 animate-spin text-muted-foreground"/>
            <p className="text-sm text-muted-foreground">Verifying your email address…</p>
          </div>
        )}

        {status === "changed" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Email verified</p>
            <p className="text-xs text-muted-foreground">
              Your email is verified and linked to your account.
            </p>
            <Button asChild className="w-full mt-1">
              <Link href="/account/me">Back to your account</Link>
            </Button>
          </div>
        )}

        {status === "merged" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Accounts linked</p>
            <p className="text-xs text-muted-foreground">
              Your sign-in methods now belong to one account. Sign in again to continue.
            </p>
            <Button asChild className="w-full mt-1">
              <Link href="/account/login?next=/account/me">Sign in</Link>
            </Button>
          </div>
        )}

        {status === "signin-required" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Sign in to finish</p>
            <p className="text-xs text-muted-foreground">
              To confirm this change, sign in to your account first — you&apos;ll be brought
              straight back here.
            </p>
            <Button asChild className="w-full mt-1">
              <Link href={loginUrl}>Sign in</Link>
            </Button>
          </div>
        )}

        {status === "wrong-account" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Different account needed</p>
            <p className="text-xs text-muted-foreground">
              {error ?? "This link belongs to a different account."}
            </p>
            <Button className="w-full mt-1" onClick={switchAccount}>
              Switch account
            </Button>
          </div>
        )}

        {(status === "error" || status === "invalid") && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">
              {status === "invalid" ? "This link is invalid" : "Verification failed"}
            </p>
            <p className="text-xs text-muted-foreground">
              {status === "invalid"
                ? "The verification link is missing information. Please try adding your email again."
                : error}
            </p>
            <Button asChild variant="outline" className="w-full mt-1">
              <Link href="/account/me">Back to your account</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
