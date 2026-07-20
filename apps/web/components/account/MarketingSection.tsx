"use client";

import React, {useState} from "react";
import {Checkbox} from "@/components/ui/checkbox";
import {FormStatus, Section} from "./Section";
import type {AccountMe} from "@/lib/account/useAccountMe";

export function MarketingSection({me, onSaved}: {
  me: AccountMe;
  onSaved: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(me.acceptsMarketing ?? false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-sync when a save refetches the profile — adjusted during render, per
  // React's derived-state guidance.
  const [synced, setSynced] = useState(me.acceptsMarketing);
  if (synced !== me.acceptsMarketing) {
    setSynced(me.acceptsMarketing);
    setChecked(me.acceptsMarketing ?? false);
  }

  const handleToggle = async (next: boolean) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    // Optimistic — reverted below if the save fails.
    setChecked(next);

    try {
      const res = await fetch("/api/account/consent", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({acceptsMarketing: next}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChecked(!next);
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      await onSaved();
      setSuccess(next
        ? "You're subscribed to marketing emails."
        : "You've unsubscribed from marketing emails.");
    } catch {
      setChecked(!next);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Marketing preferences"
      description="Choose whether we can email you about new pieces and offers."
    >
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer text-sm">
          <Checkbox
            checked={checked}
            disabled={saving}
            onCheckedChange={(state) => void handleToggle(state === true)}
          />
          Email me with news and offers
        </label>
        {me.acceptsMarketing === null && !success && !error && (
          <p className="text-xs text-muted-foreground">
            We couldn&apos;t load your current preference — saving will set it fresh.
          </p>
        )}
        <FormStatus error={error} success={success}/>
      </div>
    </Section>
  );
}
