import {NextRequest, NextResponse} from "next/server";
import type {Session} from "next-auth";
import {getToken} from "next-auth/jwt";
import {withWebLogger} from "@forgedandfound/logger/web";
import {auth} from "@/auth";
import {accountApiFetch} from "@/lib/account/api-client";

/**
 * Single BFF proxy for the whole account API. Every `/api/account/*` request is
 * forwarded 1:1 to `<ACCOUNT_API_URL>/account/*` with the M2M token attached and
 * the authenticated user's identity in X-User-* headers. Adding a new operation
 * only needs a branch in the account-service Lambda — no new route here.
 */
async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  return withWebLogger(req, async () => {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const {path} = await ctx.params;
    const target = `/account/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

    const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE";
    const body = hasBody ? await req.text() : undefined;

    // Read the raw JWT rather than the session: the Cognito access token is kept
    // off the session precisely so the browser can never see it.
    const jwt = await getToken({
      req,
      secret: process.env.AUTH_SECRET!,
      secureCookie: process.env.NODE_ENV === "production",
    });

    const headers = identityHeaders(session);
    if (jwt?.cognitoAccessToken) {
      headers["x-cognito-access-token"] = jwt.cognitoAccessToken as string;
    }

    const res = await accountApiFetch(target, {
      method: req.method,
      ...(body ? {body} : {}),
      headers,
    });

    const payload = await res.text();
    return new NextResponse(payload, {
      status: res.status,
      headers: {"content-type": res.headers.get("content-type") ?? "application/json"},
    });
  });
}

function identityHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = {};
  if (session.userId) headers["x-user-id"] = session.userId;
  if (session.user?.email) headers["x-user-email"] = session.user.email;
  if (session.shopifyCustomerId) headers["x-shopify-customer-id"] = session.shopifyCustomerId;
  if (session.provider) headers["x-user-provider"] = session.provider;
  if (session.providerUserId) headers["x-user-provider-id"] = session.providerUserId;
  return headers;
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
