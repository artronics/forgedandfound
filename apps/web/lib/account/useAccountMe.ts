"use client";

import {useCallback, useEffect, useState} from "react";

export type AccountMe = {
  firstName: string;
  lastName: string;
  /** null when the account has no real address (social placeholder). */
  email: string | null;
  /** Federated (social) users can't change email/password here. */
  isSocial: boolean;
  /** null when consent is unknown (no Shopify customer, or the lookup failed). */
  acceptsMarketing: boolean | null;
};

/** The signed-in user's account profile from /api/account/me. */
export function useAccountMe() {
  const [me, setMe] = useState<AccountMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/account/me", {cache: "no-store"});
      if (res.status === 401) {
        setMe(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load account (${res.status})`);
      }
      setMe(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your account.");
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return {me, loading, error, refetch: load};
}
