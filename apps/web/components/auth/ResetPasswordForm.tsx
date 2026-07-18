"use client";

import React, {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {RATE_LIMITED_ERROR} from "@/lib/auth/messages";

type ResetPasswordFormProps = {
  email: string;
  code: string;
};

export default function ResetPasswordForm({email, code}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const invalidLink = !email || !code;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({email, code, password}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(
          res.status === 429
            ? RATE_LIMITED_ERROR
            : data.error ?? "Something went wrong. Please try again.",
        );
        return;
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md bg-surface-container px-4">
      <CardHeader className="px-0 pt-8 pb-0">
        <CardTitle className="text-center pb-4">Choose a new password</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pt-6 pb-8">
        {invalidLink ? (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">This link is invalid</p>
            <p className="text-xs text-muted-foreground">
              The reset link is missing information. Please request a new one from the sign-in page.
            </p>
            <Link
              href="/account/login"
              className="mx-auto text-xs text-muted-foreground underline hover:text-foreground"
            >
              Back to sign in
            </Link>
          </div>
        ) : done ? (
          <div className="flex flex-col gap-4 text-center py-2">
            <p className="text-sm font-medium">Password updated</p>
            <p className="text-xs text-muted-foreground">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Button className="w-full mt-1" onClick={() => router.push("/account/login")}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Resetting the password for <strong>{email}</strong>.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-password" className="text-xs uppercase tracking-wider text-muted-foreground">
                New password
              </label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reset-confirm" className="text-xs uppercase tracking-wider text-muted-foreground">
                Confirm new password
              </label>
              <Input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full mt-1" disabled={loading}>
              {loading ? "Updating…" : "Reset password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
