import crypto from "node:crypto";

const SECRET = process.env.EMAIL_CHANGE_SECRET!;
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * The email-verification link token. HMAC-signed and expiring, so the link is
 * self-contained (no server-side state) yet unforgeable and unmodifiable:
 * - `change`: bound to the requesting user (`sub`) and the new address.
 * - `merge`: additionally bound to the existing account (`targetSub`) that the
 *   requester's social identities will be linked into.
 * The verify endpoint still requires an authenticated session matching the
 * relevant sub — the token proves email ownership, the session proves account
 * ownership.
 */
export type EmailTokenPayload =
  | { action: "change"; sub: string; email: string; exp: number }
  | { action: "merge"; sub: string; email: string; targetSub: string; exp: number };

type UnsignedPayload =
  | Omit<Extract<EmailTokenPayload, { action: "change" }>, "exp">
  | Omit<Extract<EmailTokenPayload, { action: "merge" }>, "exp">;

function mac(data: string): Buffer {
  return crypto.createHmac("sha256", SECRET).update(data).digest();
}

export function signEmailToken(payload: UnsignedPayload): string {
  const body = Buffer.from(
    JSON.stringify({...payload, exp: Date.now() + TOKEN_TTL_MS}),
  ).toString("base64url");
  return `${body}.${mac(body).toString("base64url")}`;
}

/** Returns the payload only for a well-formed, correctly signed, unexpired token. */
export function verifyEmailToken(token: string): EmailTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = mac(body);
  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as EmailTokenPayload;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (payload.action !== "change" && payload.action !== "merge") return null;
    return payload;
  } catch {
    return null;
  }
}
