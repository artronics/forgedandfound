import NextAuth, {CredentialsSignin} from "next-auth";
import Cognito from "next-auth/providers/cognito";
import Credentials from "next-auth/providers/credentials";
import {getLogger} from "@forgedandfound/logger/web";
import {getOrCreateCustomer} from "@/lib/shopify/admin/customer";
import {decodeIdToken, refreshTokens, signInWithPassword} from "@/lib/auth/cognito";
import type {JWT} from "next-auth/jwt";
import {oidc_config} from "@/lib/env";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "EmailNotVerified";
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  // Keep auth failures on our own login page instead of NextAuth's default
  // error page.
  pages: {
    signIn: "/account/login",
    error: "/account/login",
  },
  providers: [
    Cognito({
      clientId: oidc_config.cognito_client_id,
      clientSecret: oidc_config.cognito_client_secret,
      issuer: oidc_config.cognito_issuer_url,
      // IMPORTANT: Do not delete this line otherwise, you'll get "nonce" error when login with Google
      checks: ["nonce", "pkce", "state"],
    }),

    Credentials({
      credentials: {
        email: {label: "Email", type: "email"},
        password: {label: "Password", type: "password"},
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        try {
          const tokens = await signInWithPassword(email, password);
          if (!tokens?.IdToken) return null;

          const claims = decodeIdToken(tokens.IdToken);
          const name = [claims.given_name, claims.family_name]
            .filter(Boolean)
            .join(" ")
            .trim();

          return {
            id: claims.sub ?? email,
            email: claims.email ?? email,
            name: name || null,
            shopifyCustomerId: claims["custom:shopify_customer_id"],
            emailPlaceholder: claims["custom:email_placeholder"] === "true",
            cognitoUsername: claims["cognito:username"] ?? claims.sub,
            cognitoAccessToken: tokens.AccessToken,
            cognitoRefreshToken: tokens.RefreshToken,
            cognitoExpiresAt: Date.now() + (tokens.ExpiresIn ?? 3600) * 1000,
          };
        } catch (err) {
          const name = (err as { name?: string }).name;
          if (name === "UserNotConfirmedException") {
            throw new EmailNotVerifiedError();
          }
          // NotAuthorizedException / UserNotFoundException / anything else →
          // generic invalid-credentials failure.
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({token, user, profile, account, trigger}) {
      // Keep the user's Cognito tokens on the JWT (server-side only — they are
      // deliberately never copied into the session, which the browser can read)
      // so the session can outlive the ~1h Cognito token lifetime.
      if (account?.access_token) {
        // Social / hosted-UI sign-in.
        token.cognitoAccessToken = account.access_token;
        token.cognitoRefreshToken = account.refresh_token;
        token.cognitoExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600_000;
        // REFRESH_TOKEN_AUTH needs the real Username for its SECRET_HASH; for
        // federated users that is `<Provider>_<id>`, not the sub.
        const username = (profile as Record<string, unknown> | undefined)?.["cognito:username"];
        if (typeof username === "string") token.cognitoUsername = username;
      } else if (user?.cognitoAccessToken) {
        // Credentials sign-in.
        token.cognitoAccessToken = user.cognitoAccessToken;
        token.cognitoRefreshToken = user.cognitoRefreshToken;
        token.cognitoExpiresAt = user.cognitoExpiresAt;
        token.cognitoUsername = user.cognitoUsername;
      }

      // `trigger === "update"` is our explicit "re-read the user's attributes
      // now" signal (fired via /api/auth/refresh-session after account
      // changes) — force a token refresh so the fresh ID token claims land.
      await refreshCognitoTokenIfExpired(token, trigger === "update");

      const placeholder =
        (profile as Record<string, unknown> | undefined)?.["custom:email_placeholder"] ??
        user?.emailPlaceholder;
      if (placeholder !== undefined) {
        token.emailPlaceholder = placeholder === true || placeholder === "true";
      }

      const customerId =
        (profile as Record<string, unknown> | undefined)?.[
          "custom:shopify_customer_id"
          ] ?? user?.shopifyCustomerId;

      if (customerId && customerId !== "undefined") {
        token.shopifyCustomerId = String(customerId);
        return token;
      }

      if (token.shopifyCustomerId) return token;

      // Fallback at sign-in: federated users get their Shopify customer created
      // by the PreSignUp Lambda, but the id can't be persisted to Cognito there
      // (the user doesn't exist yet at PreSignUp time) — resolve it by email
      // here instead. Also covers the Lambda having missed its deadline.
      if (user) {
        const fallbackEmail = user.email ?? placeholderEmailFor(token.cognitoUsername);
        if (fallbackEmail) {
          getLogger().warn("shopify customer id missing, resolving customer for user");
          token.shopifyCustomerId = await getOrCreateCustomer(fallbackEmail);
        }
      }

      return token;
    },

    async session({session, token}) {
      session.shopifyCustomerId = token.shopifyCustomerId as string;
      session.userId = token.sub ?? "";
      session.emailPlaceholder = token.emailPlaceholder ?? false;
      return session;
    },
  },
});

/**
 * Mirror of the sync Lambda's synthetic address for social users whose provider
 * gave us no email (see services/auth-shopify-customer-sync-handler) — keep the
 * two in sync. Lets an email-less session still resolve its Shopify customer.
 * Returns undefined for native usernames or when PLACEHOLDER_EMAIL_DOMAIN is
 * not configured.
 */
function placeholderEmailFor(cognitoUsername: string | undefined): string | undefined {
  const domain = process.env.PLACEHOLDER_EMAIL_DOMAIN;
  if (!cognitoUsername || !domain) return undefined;
  const separator = cognitoUsername.indexOf("_");
  if (separator < 0) return undefined;
  const provider = cognitoUsername.slice(0, separator).toLowerCase();
  return `unknown-${provider}-${cognitoUsername.slice(separator + 1)}@${domain}`;
}

/**
 * Cognito access tokens last an hour. Refresh in place when one is close to
 * expiring so downstream calls don't fail mid-session. On failure we leave the
 * stale token — the downstream call will 401 rather than the whole session dying.
 */
async function refreshCognitoTokenIfExpired(token: JWT, force = false): Promise<void> {
  const expiresAt = token.cognitoExpiresAt;
  const username = token.cognitoUsername ?? token.sub;
  if (!token.cognitoRefreshToken || !username) return;
  if (!force && expiresAt && Date.now() < expiresAt - 60_000) return;

  try {
    const refreshed = await refreshTokens(username, token.cognitoRefreshToken);
    if (refreshed?.AccessToken) {
      token.cognitoAccessToken = refreshed.AccessToken;
      token.cognitoExpiresAt = Date.now() + (refreshed.ExpiresIn ?? 3600) * 1000;
    }
    // The fresh ID token carries the user's current attributes. Re-read the
    // claims that can change mid-session — otherwise the session shows
    // sign-in-time values until the user logs in again.
    if (refreshed?.IdToken) {
      const claims = decodeIdToken(refreshed.IdToken);
      if (claims.email) token.email = claims.email;
      if (claims["custom:shopify_customer_id"]) {
        token.shopifyCustomerId = claims["custom:shopify_customer_id"];
      }
      if (claims["custom:email_placeholder"] !== undefined) {
        token.emailPlaceholder = claims["custom:email_placeholder"] === "true";
      }
      const name = [claims.given_name, claims.family_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (name) token.name = name;
    }
  } catch (err) {
    getLogger().warn({err}, "cognito token refresh failed");
  }
}
