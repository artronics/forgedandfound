import {NextRequest, NextResponse} from "next/server";
import {signUp} from "@/lib/auth/cognito";

export async function POST(req: NextRequest) {
  let email: string;
  let password: string;
  let firstName: string | undefined;
  let lastName: string | undefined;

  try {
    const body = await req.json();
    email = body.email?.trim();
    password = body.password;
    firstName = body.firstName?.trim() || undefined;
    lastName = body.lastName?.trim() || undefined;
  } catch {
    return NextResponse.json({error: "Invalid request body."}, {status: 400});
  }

  if (!email || !password) {
    return NextResponse.json({error: "Email and password are required."}, {status: 400});
  }

  try {
    const {userConfirmed} = await signUp(email, password, {firstName, lastName});
    return NextResponse.json({userConfirmed}, {status: 201});
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    console.error("[cognito/register]", error.name, error.message);
    return NextResponse.json(
      {error: error.message ?? "Account creation failed.", type: error.name},
      {status: 422},
    );
  }
}
