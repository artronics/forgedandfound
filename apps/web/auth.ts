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
} = NextAuth({
  providers: [
    Cognito({
      clientId: oidc_config.cognito_client_id,
      clientSecret: oidc_config.cognito_client_secret,
      issuer: oidc_config.cognito_issuer_url,
      // IMPORTANT: Do not delete this line otherwise, you'll get "nonce" error when login with Google
      checks: ["nonce", "pkce", "state"],
      // aws.cognito.signin.user.admin is what lets the resulting access token call
      // UpdateUserAttributes / VerifyUserAttribute (the email-change flow).
      authorization: {
        params: {scope: "openid email profile aws.cognito.signin.user.admin"},
      },
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
    async jwt({token, user, profile, account}) {
      // Keep the user's Cognito tokens on the JWT (server-side only — they are
      // deliberately never copied into the session, which the browser can read).
      // account-service needs the access token to change an email through
      // Cognito's own verification flow.
      if (account?.access_token) {
        // Social / hosted-UI sign-in.
        token.cognitoAccessToken = account.access_token;
        token.cognitoRefreshToken = account.refresh_token;
        token.cognitoExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600_000;
      } else if (user?.cognitoAccessToken) {
        // Credentials sign-in.
        token.cognitoAccessToken = user.cognitoAccessToken;
        token.cognitoRefreshToken = user.cognitoRefreshToken;
        token.cognitoExpiresAt = user.cognitoExpiresAt;
      }

      await refreshCognitoTokenIfExpired(token);
      // Capture the federated identity (social login) so the account-service can
      // link it to a native account when the user adds an email.
      const identity = firstIdentity(profile);
      if (identity) {
        token.provider = identity.providerName;
        token.providerUserId = identity.userId;
      }

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

      // TODO: this path is not tested. It should not happen since shopify user should be created in lambda
      if (user?.email) {
        getLogger().warn("shopify customer id missing, creating customer for user");
        token.shopifyCustomerId = await getOrCreateCustomer(user.email);
      }

      return token;
    },

    async session({session, token}) {
      session.shopifyCustomerId = token.shopifyCustomerId as string;
      session.userId = token.sub ?? "";
      session.provider = token.provider;
      session.providerUserId = token.providerUserId;
      session.emailPlaceholder = token.emailPlaceholder ?? false;
      return session;
    },
  },
});

/**
 * Cognito access tokens last an hour. Refresh in place when one is close to
 * expiring so account operations don't fail mid-session. On failure we leave the
 * stale token — the downstream call will 401 rather than the whole session dying.
 */
async function refreshCognitoTokenIfExpired(token: JWT): Promise<void> {
  const expiresAt = token.cognitoExpiresAt;
  if (!token.cognitoRefreshToken || !token.sub) return;
  if (expiresAt && Date.now() < expiresAt - 60_000) return;

  try {
    const refreshed = await refreshTokens(token.sub, token.cognitoRefreshToken);
    if (refreshed?.AccessToken) {
      token.cognitoAccessToken = refreshed.AccessToken;
      token.cognitoExpiresAt = Date.now() + (refreshed.ExpiresIn ?? 3600) * 1000;
    }
  } catch (err) {
    getLogger().warn({err}, "cognito token refresh failed");
  }
}

type FederatedIdentity = { providerName: string; userId: string };

/**
 * Cognito puts an `identities` claim on federated (Google/Facebook/Apple) users.
 * It may arrive as an array or a JSON string; return the first entry if present.
 */
function firstIdentity(profile: unknown): FederatedIdentity | undefined {
  const raw = (profile as Record<string, unknown> | undefined)?.identities;
  if (!raw) return undefined;

  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  const first = Array.isArray(list) ? list[0] : undefined;
  const providerName = (first as Record<string, unknown> | undefined)?.providerName;
  const userId = (first as Record<string, unknown> | undefined)?.userId;
  if (typeof providerName === "string" && typeof userId === "string") {
    return {providerName, userId};
  }
  return undefined;
}
