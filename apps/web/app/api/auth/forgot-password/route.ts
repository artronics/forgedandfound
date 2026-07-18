import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {buildAppMetadata, forgotPassword} from "@/lib/auth/cognito";

export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let email: string | undefined;
    let origin: string | undefined;
    let returnTo: string | undefined;

    try {
      const body = await req.json();
      email = body.email?.trim();
      origin = body.origin?.trim() || undefined;
      returnTo = body.returnTo?.trim() || undefined;
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!email) {
      return NextResponse.json({error: "Email is required."}, {status: 400});
    }

    try {
      await forgotPassword(email, buildAppMetadata(origin, returnTo));
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === "LimitExceededException") {
        return NextResponse.json(
          {error: "Too many attempts. Please try again later."},
          {status: 429},
        );
      }
      // Swallow everything else (including UserNotFoundException) so the response
      // never reveals whether an account exists for this email.
      getLogger().warn({err}, "cognito forgot-password failed");
    }

    return NextResponse.json({ok: true}, {status: 200});
  });
}
