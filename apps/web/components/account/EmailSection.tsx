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
        <p className="text-sm">{me.email ?? "No email address on file."}</p>
        <p className="text-xs text-muted-foreground mt-2">
          Your email is managed by your social sign-in provider and can&apos;t be
          changed here.
        </p>
      </Section>
    );
  }

  const dirty = email.trim().toLowerCase() !== (me.email ?? "").toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
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
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      await onSaved();
      setSuccess("Your email address has been updated.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Email"
      description="Used to sign in and for order updates."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
          {saving ? "Saving…" : "Update email"}
        </Button>
      </form>
    </Section>
  );
}
