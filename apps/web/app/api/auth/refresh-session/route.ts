import {NextResponse} from "next/server";
import {auth, updateSession} from "@/auth";

/**
 * Force the session to re-read the user's Cognito attributes right now (name,
 * email, placeholder flag, Shopify customer id). Called after account changes
 * that would otherwise stay stale until the next token refresh (~1h).
 */
export async function POST() {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }

  await updateSession({});
  return NextResponse.json({ok: true});
}
