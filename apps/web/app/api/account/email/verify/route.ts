import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {verifyUserEmail} from "@/lib/auth/cognito";
import {updateCustomerProfile} from "@/lib/shopify/admin/customer";

/**
 * Confirm a pending email change with the code Cognito sent to the new address
 * (see POST /api/account/email). On success Cognito marks the new email verified
 * and makes it the active sign-in alias; only then do we mirror it onto the
 * Shopify customer, reading the now-authoritative address back from a fresh
 * token rather than trusting the client for it.
 */
export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let code: string;
    try {
      const body = await req.json();
      code = String(body.code ?? "").trim();
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!code) {
      return NextResponse.json(
        {error: "Enter the confirmation code from your email.", field: "code"},
        {status: 422},
      );
    }

    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json({error: "Not signed in."}, {status: 401});
    }
    if (auth.isSocial) {
      return NextResponse.json(
        {error: "Your email is managed by your social sign-in provider and can't be changed here."},
        {status: 403},
      );
    }
    if (!auth.accessToken) {
      return NextResponse.json(
        {error: "Your session has expired. Please sign in again."},
        {status: 401},
      );
    }

    try {
      await verifyUserEmail(auth.accessToken, code);
    } catch (err) {
      const name = (err as { name?: string }).name;
      getLogger().warn({err}, "account: email change verification failed");
      switch (name) {
        case "CodeMismatchException":
          return NextResponse.json(
            {error: "That code is incorrect. Check it and try again.", field: "code"},
            {status: 422},
          );
        case "ExpiredCodeException":
          return NextResponse.json(
            {error: "That code has expired. Request a new one.", field: "code"},
            {status: 422},
          );
        case "LimitExceededException":
        case "TooManyRequestsException":
          return NextResponse.json(
            {error: "Too many attempts. Please try again later."},
            {status: 429},
          );
        case "NotAuthorizedException":
          return NextResponse.json(
            {error: "Your session has expired. Please sign in again."},
            {status: 401},
          );
        default:
          return NextResponse.json(
            {error: "Could not confirm your email. Please try again."},
            {status: 500},
          );
      }
    }

    // Re-read claims from a fresh token: the email attribute is now the new,
    // verified address. This is the authoritative value to sync to Shopify.
    const updated = await getAccountAuth(req);
    const newEmail = updated?.claims.email;

    if (newEmail && auth.shopifyCustomerId) {
      try {
        await updateCustomerProfile(auth.shopifyCustomerId, {email: newEmail});
      } catch (err) {
        getLogger().error({err}, "email verify: shopify customer sync failed");
        return NextResponse.json(
          {error: "Your email was updated, but syncing it to your customer profile failed."},
          {status: 502},
        );
      }
    }

    return NextResponse.json({email: newEmail});
  });
}
