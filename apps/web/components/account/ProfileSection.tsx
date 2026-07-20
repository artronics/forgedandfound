"use client";

import React, {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Field, FormStatus, Section} from "./Section";
import type {AccountMe} from "@/lib/account/useAccountMe";

export function ProfileSection({me, onSaved}: {
  me: AccountMe;
  onSaved: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-sync when a save (or a change elsewhere) refetches the profile —
  // adjusted during render, per React's derived-state guidance.
  const [synced, setSynced] = useState({first: me.firstName, last: me.lastName});
  if (synced.first !== me.firstName || synced.last !== me.lastName) {
    setSynced({first: me.firstName, last: me.lastName});
    setFirstName(me.firstName);
    setLastName(me.lastName);
  }

  const dirty = firstName !== me.firstName || lastName !== me.lastName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!firstName.trim()) {
      setFieldError("First name is required.");
      return;
    }
    setFieldError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({firstName: firstName.trim(), lastName: lastName.trim()}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      await onSaved();
      setSuccess("Your name has been updated.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Profile">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field id="account-first-name" label="First name" error={fieldError}>
            <Input
              id="account-first-name"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={Boolean(fieldError)}
              placeholder="First name"
            />
          </Field>
          <Field id="account-last-name" label="Last name">
            <Input
              id="account-last-name"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </Field>
        </div>
        <FormStatus error={error} success={success}/>
        <Button type="submit" className="self-start" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save name"}
        </Button>
      </form>
    </Section>
  );
}
