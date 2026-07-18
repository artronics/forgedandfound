/**
 * Shown when a request is stopped by the Vercel firewall's rate-limit rules.
 * Those 429s carry a Vercel-generated plain-text body that never went through
 * our route handlers, so callers must not assume our JSON error shape — parse
 * the body defensively and fall back to this copy on status 429.
 */
export const RATE_LIMITED_ERROR =
  "Too many attempts. Please wait a minute and try again.";
