import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {buildAppMetadata, signUp} from "@/lib/auth/cognito";

export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let email: string;
    let password: string;
    let firstName: string | undefined;
    let lastName: string | undefined;
    let acceptsMarketing = false;
    let origin: string | undefined;
    let returnTo: string | undefined;

    try {
      const body = await req.json();
      email = body.email?.trim();
      password = body.password;
      firstName = body.firstName?.trim() || undefined;
      lastName = body.lastName?.trim() || undefined;
      acceptsMarketing = Boolean(body.acceptsMarketing);
      origin = body.origin?.trim() || undefined;
      returnTo = body.returnTo?.trim() || undefined;
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!email || !password) {
      return NextResponse.json({error: "Email and password are required."}, {status: 400});
    }

    try {
      const {userConfirmed} = await signUp(
        email,
        password,
        {firstName, lastName, acceptsMarketing},
        buildAppMetadata(origin, returnTo),
      );
      return NextResponse.json({userConfirmed}, {status: 201});
    } catch (err: unknown) {
      const error = err as { name?: string };
      getLogger().error({err}, "cognito register failed");
      // Map to fixed messages — raw Cognito messages leak implementation detail.
      // `type` is kept for UsernameExists so the client can show the
      // account-exists prompt.
      switch (error.name) {
        case "UsernameExistsException":
          return NextResponse.json(
            {error: "An account with this email already exists.", type: error.name},
            {status: 422},
          );
        case "InvalidPasswordException":
          return NextResponse.json(
            {error: "Password does not meet the requirements.", type: error.name},
            {status: 422},
          );
        case "InvalidParameterException":
          return NextResponse.json(
            {error: "That email address isn't valid.", type: error.name},
            {status: 422},
          );
        case "TooManyRequestsException":
        case "LimitExceededException":
          return NextResponse.json(
            {error: "Too many attempts. Please try again later.", type: error.name},
            {status: 429},
          );
        default:
          return NextResponse.json({error: "Account creation failed."}, {status: 422});
      }
    }
  });
}
