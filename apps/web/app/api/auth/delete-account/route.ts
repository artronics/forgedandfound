import {type NextRequest, NextResponse} from "next/server";
import {getToken} from "next-auth/jwt";
import {getLogger} from "@forgedandfound/logger/web";
import {signOut} from "@/auth";
import {deleteUser, refreshTokens} from "@/lib/auth/cognito";
import {
  findCustomerByEmail,
  requestCustomerDataErasure,
} from "@/lib/shopify/admin/customer";

/**
 * Delete the signed-in user's account.
 *
 * Reads the raw NextAuth JWT (not the session) because the Cognito access
 * token needed to authorize the self-service DeleteUser call lives only on the
 * JWT — it is deliberately never exposed on the session object.
 *
 * Order of operations: Cognito first (the authoritative account), then a
 * best-effort Shopify data-erasure request. A failed erasure is logged for
 * manual follow-up rather than surfaced — the account is already gone, so
 * reporting an error would only mislead the user into retrying with a dead
 * session.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Selects the __Secure- cookie name prefix; must match how the session
    // cookie was set (https in production, plain http in local dev).
    secureCookie: req.nextUrl.protocol === "https:",
  });

  if (!token?.sub) {
    return NextResponse.json({error: "Not signed in."}, {status: 401});
  }

  const accessToken = await resolveAccessToken(token);
  if (!accessToken) {
    return NextResponse.json(
      {error: "Your session has expired. Please sign in again to delete your account."},
      {status: 401},
    );
  }

  try {
    await deleteUser(accessToken);
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NotAuthorizedException" || name === "UserNotFoundException") {
      // Token revoked/expired mid-flight, or the account is already gone.
      return NextResponse.json(
        {error: "Your session has expired. Please sign in again to delete your account."},
        {status: 401},
      );
    }
    getLogger().error({err}, "cognito account deletion failed");
    return NextResponse.json(
      {error: "We couldn't delete your account. Please try again."},
      {status: 500},
    );
  }

  // The Shopify customer holds the PII — request erasure now that the account
  // is gone. customerRequestDataErasure works even with order history (the
  // records are redacted after Shopify's grace period, not hard-deleted).
  try {
    const customerId =
      token.shopifyCustomerId ??
      (token.email ? (await findCustomerByEmail(token.email))?.id : undefined);
    if (customerId) {
      await requestCustomerDataErasure(customerId);
    } else {
      getLogger().warn(
        {sub: token.sub},
        "account deleted but no shopify customer found to erase",
      );
    }
  } catch (err) {
    // Deliberately non-fatal: needs manual erasure via the Shopify admin.
    getLogger().error(
      {err, sub: token.sub, shopifyCustomerId: token.shopifyCustomerId},
      "account deleted but shopify data erasure failed — erase manually",
    );
  }

  // Clear the NextAuth session cookie; the JWT itself can't be revoked, but
  // every Cognito call it could authorize is now invalid anyway.
  await signOut({redirect: false});

  return NextResponse.json({ok: true});
}

/**
 * The stored access token, refreshed first when it is expired (or about to
 * be) — DeleteUser rejects stale tokens with NotAuthorizedException. Returns
 * undefined when no usable token can be produced.
 */
async function resolveAccessToken(token: {
  sub?: string;
  cognitoUsername?: string;
  cognitoAccessToken?: string;
  cognitoRefreshToken?: string;
  cognitoExpiresAt?: number;
}): Promise<string | undefined> {
  const expiresSoon =
    !token.cognitoExpiresAt || Date.now() >= token.cognitoExpiresAt - 60_000;

  if (token.cognitoAccessToken && !expiresSoon) return token.cognitoAccessToken;

  const username = token.cognitoUsername ?? token.sub;
  if (!token.cognitoRefreshToken || !username) return token.cognitoAccessToken;

  try {
    const refreshed = await refreshTokens(username, token.cognitoRefreshToken);
    return refreshed?.AccessToken ?? token.cognitoAccessToken;
  } catch (err) {
    getLogger().warn({err}, "token refresh before account deletion failed");
    return token.cognitoAccessToken;
  }
}
