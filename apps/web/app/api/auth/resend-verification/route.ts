import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {resendConfirmationCode} from "@/lib/auth/cognito";

export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let email: string | undefined;

    try {
      const body = await req.json();
      email = body.email?.trim();
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!email) {
      return NextResponse.json({error: "Email is required."}, {status: 400});
    }

    try {
      await resendConfirmationCode(email);
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === "LimitExceededException") {
        return NextResponse.json(
          {error: "Too many attempts. Please try again later."},
          {status: 429},
        );
      }
      // Swallow everything else (including UserNotFoundException and
      // InvalidParameterException for already-confirmed users) so the response
      // never reveals whether an account exists or its verification state.
      getLogger().warn({err}, "cognito resend-verification failed");
    }

    return NextResponse.json({ok: true}, {status: 200});
  });
}
