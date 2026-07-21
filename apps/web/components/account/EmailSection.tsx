"use client";

import React, {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Field, FormStatus, Section} from "./Section";
import type {AccountMe} from "@/lib/account/useAccountMe";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailSection({me, onSaved}: {
  me: AccountMe;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState(me.email ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Set once a change is started: the new address a code was emailed to. While
  // set, we show the code-entry step; the account's active email is unchanged
  // until the code is confirmed.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Re-sync when a save refetches the profile — adjusted during render, per
  // React's derived-state guidance.
  const [syncedEmail, setSyncedEmail] = useState(me.email);
  if (syncedEmail !== me.email) {
    setSyncedEmail(me.email);
    setEmail(me.email ?? "");
  }

  if (me.isSocial) {
    return (
      <Section title="Email">
        {me.email ? (
          <>
            <p className="text-sm">{me.email}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Your email comes from your social sign-in provider and can&apos;t be
              changed here.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You signed in with a social account, so there&apos;s no email address
            on your account.
          </p>
        )}
      </Section>
    );
  }

  const dirty = email.trim().toLowerCase() !== (me.email ?? "").toLowerCase();

  const resetToEdit = () => {
    setPendingEmail(null);
    setCode("");
    setCodeError(null);
    setError(null);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const next = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(next)) {
      setFieldError("Enter a valid email address.");
      return;
    }
    setFieldError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({email: next}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.field === "email") setFieldError(data.error);
        else setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setPendingEmail(next);
      setCode("");
      setCodeError(null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = code.trim();
    if (!trimmed) {
      setCodeError("Enter the confirmation code from your email.");
      return;
    }
    setCodeError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/account/email/verify", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({code: trimmed}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.field === "code") setCodeError(data.error);
        else setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      resetToEdit();
      await onSaved();
      setSuccess("Your email address has been updated.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccess(null);
    setCodeError(null);
    setResending(true);
    try {
      const res = await fetch("/api/account/email/resend", {method: "POST"});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not resend the code. Please try again.");
        return;
      }
      setSuccess("We've sent a new code to your new email address.");
    } catch {
      setError("Could not resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  if (pendingEmail) {
    return (
      <Section
        title="Email"
        description="Confirm your new address to finish the change."
      >
        <form onSubmit={handleVerify} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            We&apos;ve emailed a confirmation code to{" "}
            <span className="font-medium text-foreground">{pendingEmail}</span>.
            Enter it below to make this your account email. Until then, you can
            still sign in with your current address.
          </p>
          <Field id="account-email-code" label="Confirmation code" error={codeError}>
            <Input
              id="account-email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-invalid={Boolean(codeError)}
              placeholder="123456"
            />
          </Field>
          <FormStatus error={error} success={success}/>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Confirming…" : "Confirm new email"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Sending…" : "Resend code"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetToEdit}>
              Cancel
            </Button>
          </div>
        </form>
      </Section>
    );
  }

  return (
    <Section
      title="Email"
      description="Used to sign in and for order updates."
    >
      <form onSubmit={handleStart} className="flex flex-col gap-3">
        <Field id="account-email" label="Email address" error={fieldError}>
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(fieldError)}
            placeholder="you@example.com"
          />
        </Field>
        <FormStatus error={error} success={success}/>
        <Button type="submit" className="self-start" disabled={saving || !dirty}>
          {saving ? "Sending…" : "Update email"}
        </Button>
      </form>
    </Section>
  );
}
