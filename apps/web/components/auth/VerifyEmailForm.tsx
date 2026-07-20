"use client";

import React, {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {signIn} from "next-auth/react";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Icon} from "@/components/ui/icon";

type VerifyEmailFormProps = {
  email: string;
  code: string;
  next: string;
};

type Status = "verifying" | "confirmed" | "error" | "invalid";

/**
 * Only follow an in-app path — reject absolute URLs and protocol-relative
 * ("//evil.com") values so a crafted `next` can't turn the post-login redirect
 * into an off-site redirect. Falls back to the home page.
 */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function VerifyEmailForm({email, code, next}: VerifyEmailFormProps) {
  const [status, setStatus] = useState<Status>(email && code ? "verifying" : "invalid");
  const [error, setError] = useState<string | null>(null);
  const backTo = safeNext(next);
  // React 18 Strict Mode mounts effects twice in dev; guard so we only confirm once.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!email || !code || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/confirm", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({email, code}),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          // Confirmation fires automatically on page load, so on a rate-limit
          // 429 the retry is reloading this page — don't send them off to
          // request a new link over a throttle.
          setError(
            res.status === 429
              ? "Too many attempts. Please wait a minute, then reload this page."
              : data.error ?? "We couldn't verify your email. Please request a new link.",
          );
          setStatus("error");
          return;
        }

        setStatus("confirmed");
      } catch {
        setError("Something went wrong. Please try again.");
        setStatus("error");
      }
    })();
  }, [email, code]);

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

        {status === "confirmed" && (
          <SignInStep email={email} redirectTo={backTo}/>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Verification failed</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button asChild variant="outline" className="w-full mt-1">
              <Link href={backTo}>Back to shopping</Link>
            </Button>
          </div>
        )}

        {status === "invalid" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">This link is invalid</p>
            <p className="text-xs text-muted-foreground">
              The verification link is missing information. Please request a new one from the sign-in page.
            </p>
            <Button asChild variant="outline" className="w-full mt-1">
              <Link href={backTo}>Back to shopping</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SignInStep({email, redirectTo}: { email: string; redirectTo: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {email, password, redirect: false});

      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <p className="text-sm font-medium">Email verified</p>
        <p className="text-xs text-muted-foreground pt-1">
          Sign in to finish and continue shopping.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="verify-email" className="text-xs uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            readOnly
            aria-readonly="true"
            value={email}
            className="cursor-default text-muted-foreground focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="verify-password" className="text-xs uppercase tracking-wider text-muted-foreground">
            Password
          </label>
          <Input
            id="verify-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full mt-1" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
