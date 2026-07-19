import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {patchUser} from "@/lib/account/user-service.server";
import {updateCustomerMarketingConsent} from "@/lib/shopify/admin/customer";

/**
 * Set the user's email-marketing consent on the Shopify customer (where it
 * operationally lives) and mirror it to Cognito's `custom:accepts_marketing`
 * so the user's profile record stays authoritative.
 */
export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let acceptsMarketing: boolean;
    try {
      const body = await req.json();
      if (typeof body.acceptsMarketing !== "boolean") {
        return NextResponse.json({error: "acceptsMarketing must be a boolean."}, {status: 400});
      }
      acceptsMarketing = body.acceptsMarketing;
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json({error: "Not signed in."}, {status: 401});
    }
    if (!auth.shopifyCustomerId) {
      return NextResponse.json(
        {error: "We couldn't update your preferences. Please try again later."},
        {status: 409},
      );
    }

    try {
      await updateCustomerMarketingConsent(auth.shopifyCustomerId, acceptsMarketing);
    } catch (err) {
      getLogger().error({err}, "consent: shopify update failed");
      return NextResponse.json(
        {error: "We couldn't update your preferences. Please try again."},
        {status: 502},
      );
    }

    // Best-effort mirror to the Cognito profile — Shopify already holds the
    // operative consent, so a failure here shouldn't fail the request.
    const result = await patchUser(auth.sub, auth.idToken, {acceptsMarketing});
    if (!result.ok) {
      getLogger().warn(
        {status: result.status, error: result.error},
        "consent: cognito mirror failed (non-fatal)",
      );
    }

    return NextResponse.json({acceptsMarketing});
  });
}
