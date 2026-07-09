# Project Memory: Forged & Found Frontend

## Auth Architecture

- **Two auth flows unified via `lib/auth/`**:
    - Email/password → `/api/auth/email/login` → Cognito `InitiateAuthCommand` → sets httpOnly cookie
      `app_customer_session`
    - OIDC/OAuth (Google etc.) → `react-oidc-context` PKCE flow
- **Session cookie**: base64url-encoded JSON `{ type, accessToken, refreshToken, expiresAt, idToken }` — see
  `lib/auth/session.ts`
- **`/api/auth/me`**: server endpoint that decodes cookie and returns `{ authenticated, sub, email }`
- **`lib/auth/AuthProvider.tsx`**: wraps `react-oidc-context`'s `AuthProvider` + a custom `CookieSessionProvider` that
  polls `/api/auth/me` on mount
- **`lib/auth/useAuth.ts`**: unified hook merging OIDC and cookie session state →
  `{ isAuthenticated, isLoading, user, refresh }`
- **`lib/auth/useReturnTo.ts`**: saves/restores current URL to localStorage (`auth_return_to`) for post-login redirect

## Key Files

- `app/(store)/layout.tsx` — store layout, uses `AuthProvider` from `@/lib/auth/AuthProvider`
- `lib/auth/session.ts` — `AppSession` type, `setSessionCookie`, `getSessionFromRequest`, `encodeSession`/
  `decodeSession`
- `lib/auth/AuthProvider.tsx` — Cognito OIDC config hardcoded here (authority, client_id, redirect_uri)
- `lib/auth/useAuth.ts` — `useAuth()` hook for components
- `lib/auth/useReturnTo.ts` — `useReturnTo()` → `{ save, restore }`
- `lib/config.server.ts` — cookie name: `app_customer_session`
- `app/api/auth/email/login/route.ts` — Cognito `InitiateAuthCommand` (USER_PASSWORD_AUTH)
- `app/api/auth/email/register/route.ts` — Cognito `SignUpCommand`
- `app/api/auth/email/verify/route.ts` — Cognito confirm signup
- `app/api/auth/me/route.ts` — reads cookie, decodes JWT payload, returns user claims
- `components/ui/LoginForm.tsx` — calls `refresh()` + `restore()` + `router.push()` on login success

## Cognito Config

- Region: `eu-west-2`
- User Pool: `eu-west-2_02GETBiZc`
- OIDC authority: `https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_02GETBiZc`
- Env vars: `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`

## Search Feature

- **Drawer**: `SearchDrawer.tsx` + `Search.tsx` — opens sheet from top, shows autocomplete via Shopify
  `predictiveSearch`
- **Full results page**: `app/(store)/search/page.tsx` → reads `?q=` param → `SearchResults.tsx`
- **`lib/search/`**: `fragment.graphql`, `query.graphql` (PredictiveSearch + SearchProducts), `usePredictiveSearch.ts`,
  `useSearchHistory.ts`, `useSearch.ts`
- Codegen command:
  `NEXT_PUBLIC_SHOPIFY_STORE_NAME=forged-and-found-dev NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN=ab78324ecfa61d09fb71d62af6cf3fc0 pnpm codegen`
- Search page URL: `/search?q=<term>`

## Stack

- Next.js (App Router), TypeScript, Tailwind, Apollo GraphQL, Shopify Storefront API
- pnpm workspace
- `lib/shopify/server/customer-auth.ts` is legacy — session logic moved to `lib/auth/session.ts`
