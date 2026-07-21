# Auth flow & account-management notes

Practical notes on how Cognito auth hangs together here, and — more importantly —
the sharp edges that have already cost us time. Read this before touching email
change, account delete, social sign-in, or the Cognito Terraform. It spans three
Terraform-managed deployables plus the Vercel web app, so a change in one place
often needs matching changes in another.

## The moving parts

| Piece | Where | Role |
|---|---|---|
| Cognito user pool | `terraform/infra/cognito.tf` | One pool per AWS account. Users, IdPs, triggers, attribute rules. |
| IdP config | `terraform/infra/cognito-idp.tf` | Google / Apple / Facebook federation + attribute mapping. |
| App client | `terraform/platform/cognito-client.tf` | Per-deployment OAuth client. **OAuth scopes live here** — they gate what a user's own token may do. |
| user-service Lambda | `services/user-service` + `terraform/platform/user-service.tf` | Admin-privileged profile writes + account delete. The web app has no AWS creds, so admin calls live here. |
| email-hook Lambda | `services/auth-email-hook-handler` | Cognito Custom Email Sender. Decrypts the code and sends the templated email. |
| customer-sync Lambda | `services/auth-shopify-customer-sync-handler` | PreSignUp / PostConfirmation. Creates/links the Shopify customer. |
| Web (BFF) | `apps/web` | `auth.ts` (NextAuth), `lib/account/*`, `app/api/account/*`. Talks to Cognito with the user's own tokens; talks to the Lambda for admin ops. |

## Two kinds of user — this is the root of everything

- **Native** (email/password): username is a UUID (== `sub`). Has a real, verified
  `email`. Signs in via `USER_PASSWORD_AUTH`.
- **Federated / social** (Google/Apple/Facebook): username is `<Provider>_<id>`
  (e.g. `Google_123`, `Facebook_456`). Carries an `identities` claim — that claim's
  presence is how we detect "social" (`isSocial`). Signs in via the hosted UI / OAuth
  code flow.

**We do NOT link identities.** Someone who used both Google and email/password has
**two separate Cognito users** with the same email, sharing one Shopify customer.
`AdminLinkProviderForUser`-based consolidation was tried and abandoned (ghost
sessions, trigger-retry aborts, hosted-UI staleness) — see the note atop
`services/auth-shopify-customer-sync-handler/index.ts`. Don't reintroduce it.

**Email is a sign-in alias** (`username_attributes = ["email", ...]`). That single
fact drives most of the traps below: anything that lets an unverified/attacker-chosen
address become a verified email is an account-takeover vector.

## Placeholder emails (social sign-up with no email, e.g. Facebook)

Some providers don't give us an email (Facebook accounts registered by phone; the
user declined the email scope). For those:

- Cognito has **no `email` attribute at all** for the user. The synthetic address
  `unknown-<provider>-<id>@no-reply.<zone>` (see `placeholderEmail()` in the sync
  handler, mirrored by `placeholderEmailFor()` in `apps/web/auth.ts`) is used **only**
  to key/create the Shopify customer. It is **never written to Cognito**.
- So for these users `claims.email` and `session.user.email` are **null/empty**.
- Detect the state as **`isSocial && !email`**. There is a `custom:email_placeholder`
  reference floating around — **ignore it**, it is not a real pool-schema attribute and
  is never set. `session.emailPlaceholder` is instead derived in `auth.ts` (see below).

Consequences already wired up:
- Account page (`components/account/EmailSection.tsx`): shows a plain "no email on your
  account" note; no edit form. `MarketingSection` is hidden for these users
  (`AccountSettings.tsx`) — a marketing toggle with no address is meaningless.
- Cart (`lib/cart/useCartBuyerIdentity.ts`): **skips the buyer-identity update** when
  `session.emailPlaceholder`, so the fake/absent email never rides into Shopify
  checkout. Checkout collects a real address as for any guest.
- `session.emailPlaceholder` is computed in the `auth.ts` **session callback** as
  `!token.email || token.email === placeholderEmailFor(cognitoUsername)` — reliable and
  covers both "no email" and "synthetic email". (Historically it was derived from the
  non-existent `custom:email_placeholder` and was dead.)

## Changing your email — native only, and why

### Native users: verify-before-update (self-service)

Flow (all in `apps/web`, no admin Lambda):
1. `POST /api/account/email` → `updateUserEmail()` = Cognito `UpdateUserAttributes`
   with the user's **access token**.
2. Because the pool has `attributes_require_verification_before_update = ["email"]`,
   Cognito keeps the **old** verified email active (sign-in never breaks) and emails a
   **code** to the new address.
3. The email-hook Lambda handles `CustomEmailSender_UpdateUserAttribute` /
   `_VerifyUserAttribute` and sends the code (`VerifyEmailChangeEmail`, a code, no link —
   the user is already signed in on the account page).
4. `POST /api/account/email/verify` → `verifyUserEmail()` = `VerifyUserAttribute`. Now the
   new email is active + verified. The route then syncs the Shopify customer.

### Social users: blocked. Here's the hard constraint.

`UpdateUserAttributes` / `VerifyUserAttribute` / `GetUserAttributeVerificationCode` are
**self-service** calls that require the access token to carry the
**`aws.cognito.signin.user.admin`** scope.

- **Native** tokens (from `USER_PASSWORD_AUTH`) **always** include that scope.
- **Federated / hosted-UI** tokens only get it if it's listed in the app client's
  `allowed_oauth_scopes` — and it currently is **not** (`cognito-client.tf` grants only
  `["openid", "email", "profile"]`).

So a social user's token **cannot** run the verify flow. The email routes deliberately
`403` all social users, and `EmailSection` shows the read-only note.

We tried enabling "add + verify a real email" for placeholder (Facebook) users by adding
`aws.cognito.signin.user.admin` to the app client scopes. It was **reverted** (scope
broadening + federated-attribute-resync uncertainty weren't worth it for the use case).
**If you resurrect this:** you must (a) add that scope, (b) re-login every social user to
mint a scoped token, (c) confirm Cognito doesn't clobber the set email on the next
federated login (Facebook returns no email, so its `email` mapping should leave the value
alone — verify this empirically), and (d) relax the `isSocial` guard in
`app/api/account/email/route.ts` + `verify/route.ts` to allow only `isSocial && !claims.email`
(the first-email case), not social users who already have a provider email.

Also note: the **user-service Lambda deliberately does NOT handle email** either. An
admin `AdminUpdateUserAttributes` that set `email` + `email_verified=true` in one call
(the original design) is an account-takeover vector precisely because email is an alias.
Don't add email back to the Lambda's `patchUser`.

## THE TRAP: verify-before-update needs three deploys in lockstep

`attributes_require_verification_before_update = ["email"]` only produces the "keep old
active, email a code to the new" behaviour when **all three** are deployed together:

1. the pool setting — `terraform/infra` apply,
2. the email-hook Lambda that handles the `UpdateUserAttribute`/`VerifyUserAttribute`
   triggers — rebuild + push its image,
3. the web app.

Miss any one and the new email lands **unverified with no code sent** — which looks
*exactly* like the setting is broken. It is not broken; it is under-deployed. This
burned us once already. When email change "doesn't send a code," check the deploy matrix
before debugging Cognito.

## Deleting an account — admin Lambda, deletes ALL records for the email

`DELETE /user/{id}` on the user-service Lambda (`AdminDeleteUser`), **not** self-service
`DeleteUser` — because social tokens lack `aws.cognito.signin.user.admin` (same scope
story as above), self-service delete would fail for social users.

Because one person can hold multiple unlinked Cognito users for the same verified email
(the Google-and-native case), delete must remove **every** Cognito user matching the
caller's email, or the sibling is orphaned pointing at a now-deleted Shopify customer.
The Lambda does `ListUsers Filter='email = "…"'` → `AdminDeleteUser` on each (always
including the caller). Needs IAM `AdminDeleteUser` **and** `ListUsers`
(`terraform/platform/user-service.tf`). The web route then deletes the single shared
Shopify customer.

## API Gateway authorizer wants ID tokens, not access tokens

The Cognito authorizer on the user-service API (`terraform/platform/api.yaml`) validates
**ID tokens**. The NextAuth JWT stores only access + refresh tokens, so account BFF routes
call `refreshTokens()` per request to mint a fresh ID token
(`apps/web/lib/account/session.server.ts`). Pool refresh tokens aren't rotated, so
repeated refreshes are safe. Use `claims.sub` (the ID token's own sub) as the path id —
for federated users the NextAuth sub can differ and the Lambda authorizes against
`claims.sub`.

## Quick "before you change X" checklist

- Touching the **custom attribute name/shape** (`custom:shopify_customer_id`, etc.)?
  Update all of: `auth.ts`, both trigger Lambdas, and the pool schema.
- Adding a **required env var**? Wire it into the central spot (`apps/web/lib/env.ts`,
  service `index.ts`, etc.), not scattered `process.env.X!`.
- Changing **email/verify behaviour**? Remember the three-deploy trap above.
- Adding a **self-service Cognito call** for social users? It needs the
  `aws.cognito.signin.user.admin` scope in `cognito-client.tf` first — otherwise route it
  through the admin Lambda.
