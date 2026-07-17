"use client";

import {signIn} from "next-auth/react";

/**
 * Social sign-in with a one-shot automatic retry.
 *
 * The first-ever sign-in with a social provider is deliberately failed by the
 * PreSignUp Lambda after it links the identity into a native account (the
 * aborted sign-in's tokens would carry a sub that doesn't exist in the pool).
 * Cognito surfaces that as an OAuth callback error, which NextAuth redirects to
 * /account/login?error=… — so before starting a social sign-in we stash which
 * provider was used, and when the login page loads with an error and an
 * unconsumed stash, it retries that provider once. The retry signs into the
 * linked native user and succeeds. Real provider failures also get one silent
 * retry, then surface normally.
 */
const RETRY_KEY = "ff:social-signin";
const RETRY_WINDOW_MS = 5 * 60_000;

type RetryState = {
  provider: string;
  callbackUrl: string;
  at: number;
  retried: boolean;
};

export function socialSignIn(provider: string, callbackUrl: string): void {
  try {
    const state: RetryState = {provider, callbackUrl, at: Date.now(), retried: false};
    sessionStorage.setItem(RETRY_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable — sign-in still works, we just can't auto-retry.
  }
  void signIn("cognito", {callbackUrl}, {identity_provider: provider});
}

/**
 * Called by the login page when it renders with an auth error in the URL.
 * Returns true when a retry was started (the caller should show a "finishing
 * sign-in" state instead of an error).
 */
export function retrySocialSignInOnce(): boolean {
  let state: RetryState | null = null;
  try {
    const raw = sessionStorage.getItem(RETRY_KEY);
    state = raw ? (JSON.parse(raw) as RetryState) : null;
  } catch {
    return false;
  }

  if (!state?.provider || state.retried || Date.now() - state.at > RETRY_WINDOW_MS) {
    try {
      sessionStorage.removeItem(RETRY_KEY);
    } catch {
      // ignore
    }
    return false;
  }

  try {
    sessionStorage.setItem(RETRY_KEY, JSON.stringify({...state, retried: true}));
  } catch {
    return false;
  }
  void signIn("cognito", {callbackUrl: state.callbackUrl}, {identity_provider: state.provider});
  return true;
}
