import {NextRequest, NextResponse} from "next/server";
import {confirmForgotPassword} from "@/lib/auth/cognito";

export async function POST(req: NextRequest) {
  let email: string | undefined;
  let code: string | undefined;
  let password: string | undefined;

  try {
    const body = await req.json();
    email = body.email?.trim();
    code = body.code?.trim();
    password = body.password;
  } catch {
    return NextResponse.json({error: "Invalid request body."}, {status: 400});
  }

  if (!email || !code || !password) {
    return NextResponse.json(
      {error: "Email, code and new password are required."},
      {status: 400},
    );
  }

  try {
    await confirmForgotPassword(email, code, password);
    return NextResponse.json({ok: true}, {status: 200});
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    console.error("[cognito/reset-password]", error.name, error.message);

    switch (error.name) {
      case "CodeMismatchException":
      case "ExpiredCodeException":
        return NextResponse.json(
          {error: "This reset link is invalid or has expired. Please request a new one."},
          {status: 400},
        );
      case "InvalidPasswordException":
        return NextResponse.json(
          {error: error.message ?? "Password does not meet the requirements."},
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
          {error: "Could not reset your password. Please request a new link."},
          {status: 400},
        );
    }
  }
}
