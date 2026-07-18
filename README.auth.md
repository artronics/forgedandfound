# Auth on this branch — how it works and why it looks like this

> **Status: abandoned.** This branch (`feat/account-page`) implements full IdP
> consolidation — one Cognito native user per person, no matter how they sign
> in. It works, but the machinery required to make Cognito behave (trigger
> aborts, client-side retry state machines, logout bounces) is too complex for
> both the backend and the user experience. The branch is kept for reference.
> The lessons worth carrying to the older, simpler implementation are distilled
> in [AUTH.md](AUTH.ai.md).

## The goal

One person = **one Cognito native user**, regardless of whether they arrive via
email/password, Google, Facebook, or Apple. That native user is the **source of
truth**: it holds the profile, the email, and `custom:shopify_customer_id`,
and the Shopify customer record follows it. Social identities are *linked into*
the native user rather than existing as separate accounts, so someone who
registers with Google on Monday and tries email/password on Tuesday lands on
the same account, same order history, same Shopify customer.

The hard part is that Cognito was not designed for this. Its federated sign-in
model wants one standalone user per provider identity, and every mechanism this
branch adds exists to fight that default.

## The moving parts

| Piece                                              | Role                                                                                                                                                                                                                         |
|----------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `apps/web/auth.ts`                                 | NextAuth v5. Two providers: Cognito OIDC (hosted UI, social) and Credentials (direct `USER_PASSWORD_AUTH` against Cognito). JWT sessions; Cognito tokens live server-side on the JWT, never in the browser-readable session. |
| `apps/web/lib/auth/social-sign-in.ts`              | Client-side state machine that makes social sign-in survive the deliberate first-sign-in abort (see below).                                                                                                                  |
| `apps/web/app/api/account/*`                       | BFF proxy. Requires a session, then forwards to API Gateway with an M2M `client_credentials` token plus `X-User-*` headers carrying the verified session identity.                                                           |
| `services/account-service`                         | Lambda behind API Gateway (Cognito authorizer, `account/write` scope). All admin-privilege account operations: set password, change/add email, merge accounts, update profile, delete account.                               |
| `services/auth-shopify-customer-sync-handler`      | Cognito **PreSignUp** + **PostConfirmation** trigger. Creates the native user + Shopify customer for social sign-ins, links the social identity, writes `custom:shopify_customer_id` back onto the user.                     |
| `services/auth-email-hook-handler`                 | Cognito **Custom Email Sender**. Decrypts the KMS-encrypted code and sends templated verify/reset emails via SES (`packages/email`).                                                                                         |
| `terraform/auth/*`, `terraform/account-service.tf` | Pool, IdPs and attribute mappings, app clients, M2M client, the Lambdas, SES, IAM.                                                                                                                                           |

## Flow 1 — email/password registration

Ordinary Cognito: `SignUp` → custom email sender emails a verification link →
user confirms → **PostConfirmation** trigger creates the Shopify customer and
stamps `custom:shopify_customer_id`. The native user's `Username` equals its
`sub`. Nothing exotic here.

## Flow 2 — first social sign-in (the heart of the complexity)

Cognito's *only* supported way to attach a federated identity to a native user
is `AdminLinkProviderForUser`, and it must run **before** Cognito creates the
standalone federated user. The only hook that early is the
`PreSignUp_ExternalProvider` trigger. So:

1. User clicks "Sign in with Google". The client **first bounces through
   Cognito's `/logout`** (`/api/auth/federated-logout`) to guarantee a clean
   hosted-UI session (see watch-outs), then starts the real authorize.
2. Cognito fires `PreSignUp_ExternalProvider`. The Lambda:
    - Decides whether the provider email is trustworthy: it must exist, the
      provider's `email_verified` claim must be `true`, and it must not be an
      Apple relay address. Otherwise a **placeholder email** is synthesized
      (`unknown-<provider>-<id>@no-reply…`) and flagged with
      `custom:email_placeholder=true`.
    - Finds an existing native user by that email (only CONFIRMED + verified —
      otherwise an attacker could pre-register on a victim's address and have
      the victim's social sign-in merged into it), or creates one via
      `AdminCreateUser` + permanent random password, plus a Shopify customer.
    - Links the social identity into the native user with
      `AdminLinkProviderForUser`.
    - **Deliberately throws** (`ACCOUNT_LINKED_RETRY`) to abort this sign-in.
      If the sign-in were allowed to complete, Cognito would mint tokens for a
      *transient* federated identity whose `sub` is never persisted — a "ghost
      session" that passes signature checks but fails every user-pool operation
      with `UserNotFoundException`.
3. The browser lands back on `/account/login?error=…`. The state machine in
   `social-sign-in.ts` (sessionStorage, 5-minute window) sees the failure,
   bounces through Cognito `/logout` again (the aborted leg leaves a half-baked
   hosted-UI session cookie that would otherwise poison the retry with another
   unredeemable code), and silently retries the sign-in.
4. The retry finds the identity already linked, so Cognito issues tokens for
   the **native** user — real `sub`, real attributes. Done. Apple's retry waits
   for a user click instead of auto-redirecting, because Apple's risk engine
   treats machine-paced returns to its login sheet as suspicious.

As defense in depth, the NextAuth `jwt` callback rejects any social sign-in
whose access token can't perform `GetUser` (`accessTokenUserExists`) — the
signature of a ghost session.

## Flow 3 — add / change email, and account merge

Cognito's self-service email change is unusable here: it swaps the address
immediately and leaves it unverified, external-provider-linked users can't
complete `VerifyUserAttribute`, and "email already in use" was a dead end. This
branch replaces it entirely with a **signed-token flow** in `account-service`
(`tokens.ts`: HMAC-SHA256, 1-hour expiry, bound to the requesting `sub`):

- **Change/add** (address is free): a verification link is emailed to the new
  address. Nothing is written to Cognito until the link is confirmed **by a
  session matching the token's `sub`**; then email + `email_verified=true` are
  applied in one atomic `AdminUpdateUserAttributes`, the placeholder flag is
  cleared, and the address is mirrored to Shopify.
- **Merge** (address belongs to another CONFIRMED, verified account): an
  approval link is emailed to *that* address. It can only be confirmed by a
  session whose `sub` equals the token's `targetSub` — i.e. the owner of the
  existing account. On approval, every social identity on the requester's
  leftover account is unlinked (`AdminDisableProviderForUser`) and relinked
  into the target, the leftover user is deleted, and its placeholder Shopify
  customer is erased (`customerRequestDataErasure`).

The security model in one line: **the token proves you received the email; the
session proves which account you are; both must agree.** A stray click on an
emailed link can never change or hand over an account.

`/account/verify-email` (`VerifyEmailClient.tsx`) drives the UX for every
branch: no session → sign in and return via `?next=`; wrong account → switch
account; merged → sign out and sign in fresh (the old session references a
deleted user).

## Flow 4 — passwords

Social-first users have no usable password and can't run the email reset flow,
so `POST /account/password` sets one via `AdminSetUserPassword`, with the
session as proof of ownership (no current-password prompt — there isn't one).
A "your password was changed" notification email is sent afterwards. A
`UserNotFoundException` here means the session outlived its user (deleted
account or ghost session) and maps to a 401 telling the user to sign in again.

## Sessions

Cognito access tokens last an hour; `refreshCognitoTokenIfExpired` in
`auth.ts` refreshes them in place and — importantly — **re-reads the mutable
claims** (email, name, placeholder flag, Shopify customer id) from the fresh ID
token, so mid-session account changes eventually surface. For *immediate*
freshness, `POST /api/auth/refresh-session` triggers NextAuth's
`unstable_update`, which the `jwt` callback treats as "force a refresh now"
(`trigger === "update"`). The account page calls it after profile/email
changes.

---

## ⚠ Things to watch for (hard-won Cognito facts)

These cost real debugging time. Most apply to *any* Cognito setup, not just
this branch.

1. **Cognito re-applies IdP attribute mapping on every federated sign-in** —
   including onto a *linked native user*. If the IdP's `email_verified` claim
   is not mapped (`terraform/auth/idp.tf`), Cognito stamps
   `email_verified=false` on the native user at every social sign-in, silently
   un-verifying an address you verified yourself. Google and Apple send the
   claim; **Facebook doesn't** (hence the placeholder treatment).
2. **Do not map Google's `phoneNumbers`** to `phone_number`: Google's People
   API values aren't E.164 and the mapping failure breaks sign-in for linked
   users. (Removed in `idp.tf` with a comment.)
3. **`user_attribute_update_settings` (verify-email-before-update) is
   incompatible with email-mapped federation** — token issuance for linked
   federated sign-ins fails outright. Removed from `user_pool.tf` with a
   warning comment. Also note: removing the block from Terraform does **not**
   clear the setting in AWS (provider quirk) — verify with
   `describe-user-pool` that `AttributesRequireVerificationBeforeUpdate` is
   actually empty.
4. **The ghost-session problem.** The sign-in that triggers
   `PreSignUp_ExternalProvider` gets tokens for a transient identity whose
   `sub` never persists. Every mitigation in this branch exists because of it:
   the deliberate trigger abort, the client retry machine, the
   `accessTokenUserExists` guard, the logout bounces.
5. **Cognito retries the PreSignUp trigger after a thrown error** (observed:
   second invocation ~500ms later, different request id). On the retry the
   identity is *already linked*, so `AdminLinkProviderForUser` fails with
   `InvalidParameterException: SourceUser is already linked…`. If the handler
   swallows that and returns success, Cognito completes the sign-in it was
   supposed to abort — with ghost tokens. The retry leg must throw too.
6. **The hosted-UI session cookie on the Cognito domain outlives your app's
   sign-out.** A stale/poisoned session silently mints tokens for whatever
   identity it was created as — no PreSignUp fires, no error surfaces, and the
   resulting session carries a `sub` that exists in no pool. This is why every
   social sign-in on this branch starts with a `/logout` bounce, and why the
   registered `logout_urls` on the app client include `/account/login`.
7. **`Username` vs `sub`**: for users created via `SignUp` and (empirically,
   in this pool) `AdminCreateUser`, `Username == sub` — but this is not a
   documented guarantee. Admin APIs accept email as an alias; several code
   paths rely on `Username == sub`. If it ever diverges, `AdminSetUserPassword
   (Username=sub)` style calls break with `UserNotFoundException`.
8. **PostConfirmation does not fire for federated users.** Shopify customer
   creation for social users must happen in PreSignUp (which has a **5-second
   budget** — the Shopify round-trips currently run ~3.7–4.3s cold; this is a
   standing risk and should move out of the trigger).
9. **Apple's risk engine** rejects rapid machine-paced re-authentication
   ("Failed to verify your identity") and self-clears in 1–4h. Retries must be
   user-paced. When re-testing first-time flows, revoke the app in
   appleid.apple.com first, or Apple skips the consent step.
10. **Merge links go stale.** The token pins `targetSub`; if that account is
    deleted/re-created after the email is sent, the link can never be approved
    by anyone. The service detects a missing target and says "link no longer
    valid" instead of the misleading "sign in with the right account".
11. **`ListUsers` filter injection**: the filter is a quoted string and the
    email comes from an external IdP — strip `"` and `\` before interpolating.

## Security points that still need addressing

- **No rate limiting** on the auth-adjacent routes (`/api/auth/register`,
  `forgot-password`, `resend-verification`, `/api/account/email`). Email-send
  endpoints are abusable for spam/enumeration-adjacent noise; password
  endpoints for credential stuffing.
- **Email enumeration**: `POST /account/email` returns a distinguishable 409
  ("already in use") for unverified holders, and register surfaces
  `UsernameExistsException` to drive UX. Deliberate trade-offs, but they leak
  account existence — decide explicitly.
- **`EMAIL_CHANGE_SECRET` lives in Terraform state** (`random_password`).
  State is remote and access-controlled, but rotating it invalidates in-flight
  links; consider Secrets Manager + rotation.
- **Shopify erasure is best-effort** on account deletion and merge — a failure
  is logged but the flow proceeds, so PII can outlive the account. Needs a
  reconciliation job or at least an alert.
- **The Credentials provider bypasses Cognito advanced security** (no device
  tracking, no adaptive auth), and advanced security / auth-event logging is
  not enabled on the pool at all — there is no audit trail of sign-ins.
- **`aws.cognito.signin.user.admin` scope** is still requested on the OIDC
  authorize; after the move to admin-side email changes nothing in the app
  needs it. Shrink the scope.
- **Session revocation**: JWT sessions mean a deleted/merged user's app
  session survives until expiry; downstream calls fail with 401s (mapped to
  "sign in again") but the session itself is never force-killed.
