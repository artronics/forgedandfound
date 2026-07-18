# AUTH.md — instructions for working on the `preview` branch auth

You are working on the **`preview`** branch: the older, simpler auth
implementation for this storefront (NextAuth v5 + Cognito + Shopify customer
sync). A later branch, **`feat/account-page`**, built full IdP consolidation
(one native Cognito user per person, social identities linked in via
`PreSignUp_ExternalProvider` + `AdminLinkProviderForUser`). It worked but was
abandoned as too complex for the backend and the UX. **Do not rebuild the
linking approach.** This file tells you what `preview` is missing, which
pieces of `feat/account-page` are worth porting as-is, and which Cognito traps
apply no matter what design you choose.

To inspect or lift code from the abandoned branch:
`git show feat/account-page:<path>` (or `git diff preview...feat/account-page -- <path>`).
The full design write-up is in `README.auth.md` on that branch.

## What `preview` currently has (and lacks)

- `apps/web/auth.ts`: Cognito OIDC provider (hosted UI / social) + Credentials
  provider (`USER_PASSWORD_AUTH`). **No token refresh** — Cognito tokens on the
  JWT expire after ~1h and nothing renews them. No `pages` config (auth errors
  land on NextAuth's default page).
- `services/auth-shopify-customer-sync-handler`: **PostConfirmation only**.
  Creates the Shopify customer for email/password sign-ups.
  ⚠ **PostConfirmation never fires for federated users**, so on this branch
  social users get **no Shopify customer and no `custom:shopify_customer_id`**
  (the `TODO` at the top of that file). The `jwt` callback's
  `getOrCreateCustomer` fallback papers over it per-session. Any real fix
  needs a `PreSignUp_ExternalProvider` handler (see the port list) or a
  post-sign-in reconciliation step.
- Social users are **standalone federated users** (`Google_…`, `Facebook_…`)
  — one account per provider, separate from any email/password account with
  the same address. That's the accepted trade-off of this approach; don't try
  to merge them with `AdminLinkProviderForUser` (see traps).
- No account-service Lambda, no BFF `/api/account/*` proxy, no
  change-email/set-password/delete-account features.

## Port these from `feat/account-page` (safe, design-agnostic)

Ordered roughly by value:

1. **Terraform IdP attribute mappings — `terraform/auth/idp.tf`**
    - Map the provider's `email_verified` claim for Google **and** Apple.
      Without it, Cognito stamps `email_verified=false` on the user at **every**
      federated sign-in (mappings are re-applied each login), silently
      un-verifying addresses. Facebook has no such claim — treat Facebook
      emails as unverified.
    - Do **not** map Google `phoneNumbers` → `phone_number` (non-E.164 values
      break sign-in).
2. **Never enable `user_attribute_update_settings`**
   (verify-email-before-update) on a pool with email-mapped IdPs — it breaks
   token issuance for federated sign-ins. Also: deleting the block from
   Terraform does not clear it in AWS; verify with
   `aws cognito-idp describe-user-pool` that
   `AttributesRequireVerificationBeforeUpdate` is empty.
3. **Token refresh** — `refreshCognitoTokenIfExpired` +
   `refreshTokens`/`decodeIdToken` from `apps/web/auth.ts` and
   `apps/web/lib/auth/cognito.ts`. Also re-read mutable ID-token claims
   (email, name, `custom:shopify_customer_id`) on refresh so sessions don't
   serve sign-in-time values forever. The `trigger === "update"` forced
   refresh + `POST /api/auth/refresh-session` route is a small, portable
   pattern for "make the session reflect an account change now".
4. **Shopify customer creation for social users** — lift the
   `PreSignUp_ExternalProvider` branch of
   `services/auth-shopify-customer-sync-handler/index.ts` **minus everything
   about native users and linking** (no `findNativeUserByEmail`, no
   `AdminCreateUser`, no `AdminLinkProviderForUser`, no thrown
   `AccountLinkedRetryError`). Keep: parsing `<Provider>_<id>` usernames, the
   placeholder-email pattern for providers without a trustworthy address
   (`unknown-<provider>-<id>@<domain>` + `custom:email_placeholder`), the
   Apple-relay check, the "email already exists in Shopify → enrich, don't
   duplicate" handling, and the `ListUsers` filter escaping (strip `"` and
   `\` from IdP-supplied emails). Mind the **5-second trigger budget** —
   Shopify round-trips measured 3.7–4.3s cold; prefer doing Shopify work
   async (e.g. from the app on first session) if you can.
5. **Email templates & notifications** — `packages/email` gained
   `PasswordChangedEmail` and `LinkAccountsEmail` plus render exports; the
   SESv2 send helper is `services/account-service/notifications.ts`. The
   "notify on password change, skip placeholder/unverified addresses,
   best-effort" behavior is worth keeping wherever passwords get set.
6. **`services/auth-email-hook-handler`** on `feat/account-page` removed the
   decrypted verification code from debug logs — port that; never log codes.
7. **Login UX pieces** (`apps/web/components/auth/LoginForm.tsx`):
   `resolveDestination` (safe `?next=` handling — only relative paths, rejects
   `//`), the `EmailNotVerified` `CredentialsSignin` subclass with resend UX,
   and the "account exists → offer provider buttons + emailed set-password
   link" prompt. `pages: {signIn: "/account/login", error: "/account/login"}`
   keeps auth failures on your own page.
8. **If you add any server-side account endpoints**: copy the BFF pattern from
   `feat/account-page` (`/api/account/*` requires a session, forwards identity
   in `X-User-*` headers over an M2M client-credentials token; `terraform/auth/m2m.tf`),
   and the emailed-link origin allowlist (`resolveAppOrigin` /
   `ALLOWED_APP_ORIGINS` in `services/account-service/index.ts`) so request
   bodies can't point emails at foreign domains.

## Traps — read before touching anything federated

- **`AdminLinkProviderForUser` is why the other branch died.** The linking
  sign-in mints tokens for a transient identity whose `sub` persists nowhere
  ("ghost sessions" that fail all user ops with `UserNotFoundException`);
  Cognito **retries** a PreSignUp trigger that throws (so an abort-based flow
  must abort the retry too); and the hosted-UI session cookie on the Cognito
  domain outlives app sign-out, silently re-minting tokens for dead
  identities. Making this reliable required a client-side retry state machine
  with `/logout` bounces (`apps/web/lib/auth/social-sign-in.ts`) and a
  ghost-token guard in the `jwt` callback (`accessTokenUserExists`). If you're
  ever forced back down this road, start from those files — but the standing
  decision is: don't.
- **Hosted-UI session staleness affects `preview` too**: after app sign-out,
  the Cognito-domain session survives, so "sign in with Google" may silently
  reuse it (no account chooser, no re-auth). If that matters, bounce through
  Cognito `/logout` (see `apps/web/app/api/auth/federated-logout/route.ts` on
  the other branch; the `logout_uri` must be registered in
  `terraform/auth/app.tf` `logout_urls`).
- **Apple**: its risk engine blocks rapid machine-paced re-auth ("Failed to
  verify your identity", self-clears in 1–4h) — never auto-retry Apple
  sign-ins without a user click. When testing first-time flows, revoke the app
  at appleid.apple.com first.
- **`Username` vs `sub`**: empirically equal in this pool for `SignUp`-created
  users, but don't add new code that assumes it without checking.
- **Cognito's self-service email change is a trap**: `UpdateUserAttributes`
  swaps the address immediately while unverified (breaking sign-in), and
  federated-linked users can't complete verification. If email change is
  needed, use the admin-side signed-token flow from `feat/account-page`
  (`services/account-service/tokens.ts` + the `startEmail`/`verifyEmail`
  handlers): email a signed HMAC token, and apply email +
  `email_verified=true` atomically via `AdminUpdateUserAttributes` only after
  a session matching the token confirms it.

## Known gaps to keep on the radar (apply on `preview` as well)

- No rate limiting on register / forgot-password / resend-verification /
  email-sending endpoints.
- Account-existence leaks: register surfaces `UsernameExistsException`;
  keep responses uniform where you can.
- No Cognito advanced security / auth-event trail; Credentials sign-ins
  bypass adaptive auth entirely.
- JWT sessions can't be revoked server-side — a deleted user's session lives
  until expiry; make downstream 401s tell the user to sign in again (see
  `changePassword` in `services/account-service/index.ts` on the other
  branch for the mapping).
- If accounts can be deleted, erase the Shopify customer too
  (`customerRequestDataErasure` in `packages/shopify-admin-client`) — it holds
  the PII and works even with order history.
