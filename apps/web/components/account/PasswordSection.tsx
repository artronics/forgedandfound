"use client";

import React, {useState} from "react";
import {Button} from "@/components/ui/button";
import {FormStatus, Section} from "./Section";
import {RATE_LIMITED_ERROR} from "@/lib/auth/messages";
import type {AccountMe} from "@/lib/account/useAccountMe";

/**
 * Native accounts change their password through the existing emailed-link
 * reset flow — one click here sends the link to the registered address.
 */
export function PasswordSection({me}: { me: AccountMe }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (me.isSocial || !me.email) return null;

  const handleSend = async () => {
    setError(null);
    setSuccess(null);
    setSending(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({email: me.email, origin: window.location.origin}),
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
      setSuccess(`We've emailed a password reset link to ${me.email}.`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Section
      title="Password"
      description="We'll email you a link to choose a new password."
    >
      <div className="flex flex-col gap-3">
        <FormStatus error={error} success={success}/>
        <Button
          type="button"
          className="self-start"
          onClick={handleSend}
          disabled={sending}
        >
          {sending ? "Sending…" : "Send password reset link"}
        </Button>
      </div>
    </Section>
  );
}
