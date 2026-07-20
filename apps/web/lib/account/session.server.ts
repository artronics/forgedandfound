import "server-only";
import type {NextRequest} from "next/server";
import {getToken} from "next-auth/jwt";
import {getLogger} from "@forgedandfound/logger/web";
import {
  type CognitoIdTokenClaims,
  decodeIdToken,
  refreshTokens,
} from "@/lib/auth/cognito";

/**
 * The signed-in caller of an account route, with a *fresh* Cognito ID token:
 * the raw NextAuth JWT stores only access + refresh tokens, and the API
 * Gateway Cognito authorizer wants an ID token, so we exchange the refresh
 * token on every use. The refreshed token also carries the user's current
 * attribute claims — after an update, re-reading them here is what makes the
 * new values show up.
 */
export interface AccountAuth {
  sub: string;
  idToken: string;
  claims: CognitoIdTokenClaims;
  /** True for federated (social) users, who carry an `identities` claim. */
  isSocial: boolean;
  shopifyCustomerId?: string;
  emailPlaceholder: boolean;
}

export async function getAccountAuth(req: NextRequest): Promise<AccountAuth | null> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Selects the __Secure- cookie name prefix; must match how the session
    // cookie was set (https in production, plain http in local dev).
    secureCookie: req.nextUrl.protocol === "https:",
  });

  if (!token?.sub || !token.cognitoRefreshToken) return null;

  const username = token.cognitoUsername ?? token.sub;
  try {
    const refreshed = await refreshTokens(username, token.cognitoRefreshToken);
    if (!refreshed?.IdToken) return null;

    const claims = decodeIdToken(refreshed.IdToken);
    return {
      sub: token.sub,
      idToken: refreshed.IdToken,
      claims,
      isSocial: Boolean(claims.identities),
      shopifyCustomerId:
        claims["custom:shopify_customer_id"] ?? token.shopifyCustomerId,
      emailPlaceholder: claims["custom:email_placeholder"] === "true",
    };
  } catch (err) {
    getLogger().warn({err}, "account: cognito token refresh failed");
    return null;
  }
}
