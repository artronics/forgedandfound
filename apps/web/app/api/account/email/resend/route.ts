import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {resendEmailVerificationCode} from "@/lib/auth/cognito";

/**
 * Re-send the confirmation code for a pending email change to the new address.
 * Only meaningful while a change is pending; if none is, Cognito re-sends a code
 * for the current (already verified) email, which is harmless.
 */
export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json({error: "Not signed in."}, {status: 401});
    }
    if (!auth.accessToken) {
      return NextResponse.json(
        {error: "Your session has expired. Please sign in again."},
        {status: 401},
      );
    }

    try {
      await resendEmailVerificationCode(auth.accessToken);
    } catch (err) {
      const name = (err as { name?: string }).name;
      getLogger().warn({err}, "account: email code resend failed");
      if (name === "LimitExceededException" || name === "TooManyRequestsException") {
        return NextResponse.json(
          {error: "Too many attempts. Please try again later."},
          {status: 429},
        );
      }
      if (name === "NotAuthorizedException") {
        return NextResponse.json(
          {error: "Your session has expired. Please sign in again."},
          {status: 401},
        );
      }
      return NextResponse.json(
        {error: "Could not resend the code. Please try again."},
        {status: 500},
      );
    }

    return NextResponse.json({ok: true});
  });
}
