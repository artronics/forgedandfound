import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {updateUserEmail} from "@/lib/auth/cognito";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Start changing the user's email address. Native (email/password) accounts
 * only — a social account's address belongs to its identity provider.
 *
 * This does NOT change the email in place. The pool is configured to verify
 * email before update, so Cognito keeps the current (verified) address active —
 * sign-in keeps working — and sends a confirmation code to the new address. The
 * change only lands once the user confirms it via POST /api/account/email/verify.
 * The Shopify customer is synced there, not here, so we never mirror an
 * unconfirmed address.
 */
export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let email: string;
    try {
      const body = await req.json();
      email = String(body.email ?? "").trim().toLowerCase();
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        {error: "Enter a valid email address.", field: "email"},
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
    if (auth.claims.email?.toLowerCase() === email) {
      return NextResponse.json(
        {error: "This is already your email address.", field: "email"},
        {status: 422},
      );
    }
    if (!auth.accessToken) {
      return NextResponse.json(
        {error: "Your session has expired. Please sign in again."},
        {status: 401},
      );
    }

    try {
      await updateUserEmail(auth.accessToken, email);
    } catch (err) {
      const name = (err as { name?: string }).name;
      getLogger().warn({err}, "account: email change initiation failed");
      switch (name) {
        case "AliasExistsException":
          return NextResponse.json(
            {error: "That email is already in use by another account.", field: "email"},
            {status: 409},
          );
        case "InvalidParameterException":
          return NextResponse.json(
            {error: "Enter a valid email address.", field: "email"},
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
        case "CodeDeliveryFailureException":
          return NextResponse.json(
            {error: "We couldn't send a code to that address. Check it and try again.", field: "email"},
            {status: 502},
          );
        default:
          return NextResponse.json(
            {error: "Could not start the email change. Please try again."},
            {status: 500},
          );
      }
    }

    // Code sent to the new address; the caller now collects it and calls
    // /api/account/email/verify. The current email stays active until then.
    return NextResponse.json({pending: true, email});
  });
}
