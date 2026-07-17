"use client";

import {signIn} from "next-auth/react";

/**
 * Social sign-in with a one-shot automatic retry via a Cognito logout bounce.
 *
 * The first-ever sign-in with a social provider is deliberately failed by the
 * PreSignUp Lambda after it links the identity into a native account (the
 * aborted sign-in's tokens would carry a sub that doesn't exist in the pool).
 * Cognito surfaces that abort as an authorization code that fails redemption
 * with `invalid_grant`, and NextAuth lands back on /account/login?error=….
 *
 * Retrying immediately is not enough: the aborted leg leaves a half-baked
 * hosted-UI session cookie on the Cognito domain, and a plain re-authorize can
 * silently reuse it and mint another dud code. So the retry goes through
 * Cognito's /logout endpoint first (clearing that session), returns to
 * /account/login, and only then starts the second sign-in. Phases, all stored
 * in sessionStorage so they survive the round-trips:
 *
 *   click            → "started"
 *   login?error=…    → "relogin"  + redirect to /api/auth/federated-logout
 *   login (clean)    → "retried"  + signIn(provider) again
 *   login?error=…    → give up, clear state, show the error
 */
const RETRY_KEY = "ff:social-signin";
const RETRY_WINDOW_MS = 5 * 60_000;

type RetryPhase = "started" | "relogin" | "retried";

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
  writeState({provider, callbackUrl, at: Date.now(), phase: "started"});
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
    // First failure after the click: clear the Cognito hosted-UI session, then
    // come back here (without an error) to start the second attempt.
    if (state.phase === "started") {
      if (!writeState({...state, phase: "relogin"})) return {action: "none"};
      window.location.assign("/api/auth/federated-logout");
      return {action: "redirecting"};
    }
    // The retry failed too — give up and let the error show.
    clearState();
    return {action: "none"};
  }

  // Clean load after the logout bounce: start the second attempt.
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
