import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {confirmSignUp} from "@/lib/auth/cognito";

export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let email: string | undefined;
    let code: string | undefined;

    try {
      const body = await req.json();
      email = body.email?.trim();
      code = body.code?.trim();
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!email || !code) {
      return NextResponse.json(
        {error: "Email and confirmation code are required."},
        {status: 400},
      );
    }

    try {
      await confirmSignUp(email, code);
      return NextResponse.json({ok: true}, {status: 200});
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };

      // Already-confirmed is a success from the user's point of view: it lets
      // email-scanner prefetch and double-clicks resolve to the same happy path.
      if (
        error.name === "NotAuthorizedException" &&
        /status is confirmed/i.test(error.message ?? "")
      ) {
        return NextResponse.json({ok: true, alreadyConfirmed: true}, {status: 200});
      }

      getLogger().warn({err}, "cognito confirm-signup failed");

      switch (error.name) {
        case "CodeMismatchException":
        case "ExpiredCodeException":
          return NextResponse.json(
            {error: "This verification link is invalid or has expired. Please request a new one."},
            {status: 400},
          );
        case "LimitExceededException":
        case "TooManyFailedAttemptsException":
          return NextResponse.json(
            {error: "Too many attempts. Please try again later."},
            {status: 429},
          );
        default:
          return NextResponse.json(
            {error: "Could not verify your email. Please request a new link."},
            {status: 400},
          );
      }
    }
  });
}
