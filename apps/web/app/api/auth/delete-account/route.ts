import {type NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {signOut} from "@/auth";
import {getAccountAuth} from "@/lib/account/session.server";
import {deleteUserAccount} from "@/lib/account/user-service.server";
import {deleteCustomer} from "@/lib/shopify/admin/customer";

/**
 * Delete the signed-in user's account.
 *
 * Cognito deletion goes through the user-service Lambda's admin API (authorized
 * by a fresh ID token), not self-service DeleteUser — hosted-UI/social access
 * tokens lack the scope self-service needs, which is why social sign-ins hit
 * "your session has expired" here before. Order: Cognito first (the
 * authoritative account), then a best-effort Shopify customer delete.
 */
export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json(
        {error: "Your session has expired. Please sign in again to delete your account."},
        {status: 401},
      );
    }

    const result = await deleteUserAccount(auth.sub, auth.idToken);
    if (!result.ok) {
      return NextResponse.json({error: result.error}, {status: result.status});
    }

    // Best-effort: the account is already gone, so a Shopify failure is logged
    // for manual follow-up rather than surfaced (retrying with a dead session
    // would only mislead the user).
    if (auth.shopifyCustomerId) {
      try {
        await deleteCustomer(auth.shopifyCustomerId);
      } catch (err) {
        getLogger().error(
          {err, shopifyCustomerId: auth.shopifyCustomerId},
          "account deleted but shopify customer delete failed — delete manually",
        );
      }
    }

    // Clear the NextAuth session cookie; the JWT itself can't be revoked, but
    // every Cognito call it could authorize is now invalid anyway.
    await signOut({redirect: false});

    return NextResponse.json({ok: true});
  });
}
