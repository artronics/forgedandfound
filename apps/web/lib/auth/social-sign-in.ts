"use client";

import {signIn} from "next-auth/react";

/**
 * Social sign-in that always starts from a clean Cognito hosted-UI session, with
 * a one-shot automatic retry when the sign-in links an account.
 *
 * The hosted-UI session cookie on the Cognito domain outlives our app session
 * (our sign-out never reaches the auth domain), and a stale session can poison
 * a later sign-in: Cognito silently reuses it and mints tokens for whatever
 * identity that session was created as — including a transient linking-leg
 * identity whose sub exists in no user pool. So every social sign-in first
 * bounces through Cognito's /logout (via /api/auth/federated-logout), returns
 * to /account/login, and only then starts the real authorize.
 *
 * The first-ever sign-in with a social provider is additionally failed on
 * purpose by the PreSignUp Lambda after it links the identity into a native
 * account (the aborted sign-in's tokens would carry a ghost sub). That abort
 * lands back on /account/login?error=…, and the machine walks a second
 * logout-bounce and retries. Phases, stored in sessionStorage so they survive
 * the round-trips:
 *
 *   click            → "fresh"    + redirect to /api/auth/federated-logout
 *   login (clean)    → "started"  + signIn(provider)
 *   login?error=…    → "relogin"  + redirect to /api/auth/federated-logout
 *   login (clean)    → "retried"  + signIn(provider) again (Apple waits for a click)
 *   login?error=…    → give up, clear state, show the error
 */
const RETRY_KEY = "ff:social-signin";
const RETRY_WINDOW_MS = 5 * 60_000;

type RetryPhase = "fresh" | "started" | "relogin" | "retried";

type RetryState = {
  provider: string;
  callbackUrl: string;
  at: number;
  phase: RetryPhase;
};

function readState(): RetryState | null {
  try {
    const raw = sessionStorage.getItem(RETRY_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as RetryState;
    if (!state?.provider || Date.now() - state.at > RETRY_WINDOW_MS) {
      sessionStorage.removeItem(RETRY_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function writeState(state: RetryState): boolean {
  try {
    sessionStorage.setItem(RETRY_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function clearState(): void {
  try {
    sessionStorage.removeItem(RETRY_KEY);
  } catch {
    // ignore
  }
}

export function socialSignIn(provider: string, callbackUrl: string): void {
  // Clear any hosted-UI session first; the real sign-in starts when the bounce
  // lands back on the login page. If sessionStorage is unavailable the bounce
  // state couldn't survive the redirect — sign in directly as a fallback.
  if (writeState({provider, callbackUrl, at: Date.now(), phase: "fresh"})) {
    window.location.assign("/api/auth/federated-logout");
    return;
  }
  void signIn("cognito", {callbackUrl}, {identity_provider: provider});
}

export type ResumeResult =
  | { action: "none" }
  /** A redirect is underway — show a "finishing sign-in" state. */
  | { action: "redirecting" }
  /** Ask the user to click to continue — show a confirm button. */
  | { action: "confirm"; provider: string };

/**
 * Providers whose second leg must be user-initiated. Apple's risk engine treats
 * an instant machine-paced return to its login form as suspicious ("Failed to
 * verify your identity") and its sheet asks for credentials again anyway — a
 * human-paced click both reads better and trips fewer defenses.
 */
const CONFIRM_PROVIDERS = new Set(["SignInWithApple"]);

/**
 * Called by the login page on mount. Advances the retry state machine.
 */
export function resumeSocialSignIn(hasError: boolean): ResumeResult {
  const state = readState();
  if (!state) return {action: "none"};

  if (hasError) {
    // First failure after the initial attempt: clear the Cognito hosted-UI
    // session again, then come back here (without an error) to retry.
    if (state.phase === "started") {
      if (!writeState({...state, phase: "relogin"})) return {action: "none"};
      window.location.assign("/api/auth/federated-logout");
      return {action: "redirecting"};
    }
    // The retry failed too (or the pre-sign-in bounce itself errored) — give
    // up and let the error show.
    clearState();
    return {action: "none"};
  }

  // Clean load after the pre-sign-in logout bounce: start the first attempt.
  if (state.phase === "fresh") {
    if (!writeState({...state, phase: "started"})) return {action: "none"};
    void signIn("cognito", {callbackUrl: state.callbackUrl}, {identity_provider: state.provider});
    return {action: "redirecting"};
  }

  // Clean load after the post-error logout bounce: start the second attempt.
  if (state.phase === "relogin") {
    if (CONFIRM_PROVIDERS.has(state.provider)) {
      return {action: "confirm", provider: state.provider};
    }
    if (!writeState({...state, phase: "retried"})) return {action: "none"};
    void signIn("cognito", {callbackUrl: state.callbackUrl}, {identity_provider: state.provider});
    return {action: "redirecting"};
  }

  return {action: "none"};
}

/** Fire the pending second attempt after the user clicks the confirm button. */
export function confirmPendingSignIn(): void {
  const state = readState();
  if (!state || state.phase !== "relogin") return;
  writeState({...state, phase: "retried"});
  void signIn("cognito", {callbackUrl: state.callbackUrl}, {identity_provider: state.provider});
}
