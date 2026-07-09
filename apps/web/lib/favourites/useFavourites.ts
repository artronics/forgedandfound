"use client";

import {useCallback, useEffect, useSyncExternalStore} from "react";
import {useSession} from "next-auth/react";

const STORAGE_KEY = "shopify-favourites";

// ─── Module-level shared state ────────────────────────────────────────────────
// One state object shared across every mounted hook instance (e.g. multiple
// FavouriteButtons on a product grid). Replacing the whole object on each
// mutation gives useSyncExternalStore the referential change it needs.

type State = { ids: string[]; loading: boolean };
const EMPTY: State = {ids: [], loading: false};
let _state: State = EMPTY;
let _synced = false;

const _listeners = new Set<() => void>();
const _notify = () => _listeners.forEach((l) => l());
const _subscribe = (cb: () => void) => {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
};

function _setIds(ids: string[]) {
  _state = {..._state, ids};
  _notify();
}

function _setLoading(loading: boolean) {
  _state = {..._state, loading};
  _notify();
}

// ─── localStorage helpers (guest only) ───────────────────────────────────────

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  if (ids.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFavourites() {
  const {status} = useSession();
  const isLoggedIn = status === "authenticated";

  const {ids, loading} = useSyncExternalStore(_subscribe, () => _state, () => EMPTY);

  // Guest load + logout: any time the user is unauthenticated, load from
  // localStorage and reset synced. This covers both the initial guest visit
  // and logout, including the common NextAuth path of
  // "authenticated" → "loading" → "unauthenticated" where a prev/current ref
  // check would miss the transition.
  useEffect(() => {
    if (status !== "unauthenticated") return;
    _synced = false;
    _setIds(readLocal());
  }, [status]);

  // Logged in: fetch from server, merge any guest localStorage items, then
  // clear localStorage so the server is the sole source of truth going forward.
  useEffect(() => {
    if (!isLoggedIn || _synced || _state.loading) return;
    _setLoading(true);

    const localIds = readLocal();

    fetch("/api/favourites")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json() as Promise<{ ids: string[] }>;
      })
      .then(async ({ids: serverIds}) => {
        const merged = Array.from(new Set([...localIds, ...serverIds]));

        if (localIds.length > 0) {
          await fetch("/api/favourites", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ids: merged}),
          });
          writeLocal([]);
        }

        _setIds(merged);
        _synced = true;
      })
      .catch(() => {
      })
      .finally(() => _setLoading(false));
  }, [isLoggedIn]);

  const toggle = useCallback(
    async (productId: string) => {
      if (_state.loading) return;

      if (!isLoggedIn) {
        const next = _state.ids.includes(productId)
          ? _state.ids.filter((id) => id !== productId)
          : [..._state.ids, productId];
        _setIds(next);
        writeLocal(next);
        return;
      }

      _setLoading(true);
      try {
        const res = await fetch("/api/favourites/toggle", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({productId}),
        });
        if (!res.ok) throw new Error();
        const {ids: updated} = (await res.json()) as { ids: string[] };
        _setIds(updated);
      } catch (e) {
        // leave state unchanged on error
      } finally {
        _setLoading(false);
      }
    },
    [isLoggedIn],
  );

  // Mask stale module-level state during auth transitions:
  // - status "loading": auth is uncertain, don't show anything from a previous session
  // - _synced && !isLoggedIn: server data is in memory but user is no longer logged in;
  //   the useEffect hasn't cleared it yet (runs after render)
  const stale = status === "loading" || (_synced && !isLoggedIn);
  const effectiveIds = stale ? [] : ids;

  const isFavourited = useCallback(
    (productId: string) => effectiveIds.includes(productId),
    [effectiveIds],
  );

  return {
    ids: effectiveIds,
    toggle,
    isFavourited,
    loading: loading || status === "loading" || (isLoggedIn && !_synced),
  };
}
