"use client";

import React, {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Icon} from "@/components/ui/icon";

type Status = "verifying" | "success" | "error" | "invalid";

/**
 * Confirms an add-email flow in the logged-in session: posts the emailed code to
 * the account BFF, which links the social identity to the new native account and
 * syncs Shopify. No re-sign-in needed — the current session stays valid.
 */
export default function VerifyEmailClient({email, code}: { email: string; code: string }) {
  const [status, setStatus] = useState<Status>(email && code ? "verifying" : "invalid");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!email || !code || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/account/verify", {
          method: "POST",
          headers: {"content-type": "application/json"},
          body: JSON.stringify({email, code}),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "We couldn't verify your email. Please try again.");
          setStatus("error");
          return;
        }

        setStatus("success");
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

        {status === "success" && (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Email added</p>
            <p className="text-xs text-muted-foreground">
              Your email is verified and linked to your account.
            </p>
            <Button asChild className="w-full mt-1">
              <Link href="/account/me">Back to your account</Link>
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
