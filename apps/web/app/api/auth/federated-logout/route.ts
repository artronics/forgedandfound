import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {oidc_config} from "@/lib/env";

// The hosted-UI origin comes from the issuer's discovery document
// (authorization_endpoint lives on the auth domain, unlike the issuer itself).
// Cached for the life of the server instance.
let cachedHostedUiOrigin: string | null = null;

async function getHostedUiOrigin(): Promise<string | null> {
  if (cachedHostedUiOrigin) return cachedHostedUiOrigin;
  try {
    const res = await fetch(
      `${oidc_config.cognito_issuer_url}/.well-known/openid-configuration`,
    );
    if (!res.ok) return null;
    const doc = (await res.json()) as { authorization_endpoint?: string };
    if (!doc.authorization_endpoint) return null;
    cachedHostedUiOrigin = new URL(doc.authorization_endpoint).origin;
    return cachedHostedUiOrigin;
  } catch (err) {
    getLogger().warn({err}, "federated-logout: OIDC discovery failed");
    return null;
  }
}

/**
 * Clears the Cognito hosted-UI session by bouncing through its /logout
 * endpoint, then returns to the login page. Used between the two legs of a
 * first social sign-in: the deliberately-aborted linking leg leaves a session
 * cookie on the auth domain that would otherwise poison the retry with another
 * unredeemable authorization code. The logout_uri must be registered on the
 * app client (terraform/auth/app.tf).
 */
export async function GET(req: NextRequest) {
  return withWebLogger(req, async () => {
    const returnTo = `${req.nextUrl.origin}/account/login`;

    const hostedUi = await getHostedUiOrigin();
    if (!hostedUi) {
      // Can't build the logout URL — degrade to a plain return; the retry will
      // still run, just without the session clear.
      return NextResponse.redirect(returnTo);
    }

    const url = new URL("/logout", hostedUi);
    url.searchParams.set("client_id", oidc_config.cognito_client_id);
    url.searchParams.set("logout_uri", returnTo);
    return NextResponse.redirect(url);
  });
}
