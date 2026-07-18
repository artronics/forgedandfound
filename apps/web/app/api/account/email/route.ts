import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {patchUser} from "@/lib/account/user-service.server";
import {updateCustomerProfile} from "@/lib/shopify/admin/customer";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Change the user's email address. Native (email/password) accounts only — a
 * social account's address belongs to its identity provider. Cognito is
 * updated first (via the user-service Lambda, which also marks the address
 * verified so alias sign-in keeps working), then the Shopify customer follows.
 */
export async function POST(req: NextRequest) {
  return withWebLogger(req, async () => {
    let email: string;
    try {
      const body = await req.json();
      email = String(body.email ?? "").trim().toLowerCase();
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        {error: "Enter a valid email address.", field: "email"},
        {status: 422},
      );
    }

    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json({error: "Not signed in."}, {status: 401});
    }
    if (auth.isSocial) {
      return NextResponse.json(
        {error: "Your email is managed by your social sign-in provider and can't be changed here."},
        {status: 403},
      );
    }
    if (auth.claims.email?.toLowerCase() === email) {
      return NextResponse.json(
        {error: "This is already your email address.", field: "email"},
        {status: 422},
      );
    }

    const result = await patchUser(auth.sub, auth.idToken, {email});
    if (!result.ok) {
      return NextResponse.json({error: result.error}, {status: result.status});
    }

    if (auth.shopifyCustomerId) {
      try {
        await updateCustomerProfile(auth.shopifyCustomerId, {email});
      } catch (err) {
        getLogger().error({err}, "email: shopify customer sync failed");
        return NextResponse.json(
          {error: "Your email was updated, but syncing it to your customer profile failed."},
          {status: 502},
        );
      }
    }

    return NextResponse.json({email});
  });
}
