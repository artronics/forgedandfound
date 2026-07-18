import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {patchUser} from "@/lib/account/user-service.server";
import {updateCustomerProfile} from "@/lib/shopify/admin/customer";

const NAME_MAX_LENGTH = 100;

/**
 * Change the user's first/last name: Cognito first (the source of truth), then
 * mirror to the Shopify customer.
 */
export async function PATCH(req: NextRequest) {
  return withWebLogger(req, async () => {
    let firstName: string;
    let lastName: string;
    try {
      const body = await req.json();
      firstName = String(body.firstName ?? "").trim();
      lastName = String(body.lastName ?? "").trim();
    } catch {
      return NextResponse.json({error: "Invalid request body."}, {status: 400});
    }

    if (!firstName) {
      return NextResponse.json(
        {error: "First name is required.", field: "firstName"},
        {status: 422},
      );
    }
    if (firstName.length > NAME_MAX_LENGTH || lastName.length > NAME_MAX_LENGTH) {
      return NextResponse.json(
        {error: `Names can be at most ${NAME_MAX_LENGTH} characters.`},
        {status: 422},
      );
    }

    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json({error: "Not signed in."}, {status: 401});
    }

    const result = await patchUser(auth.sub, auth.idToken, {firstName, lastName});
    if (!result.ok) {
      return NextResponse.json({error: result.error}, {status: result.status});
    }

    if (auth.shopifyCustomerId) {
      try {
        await updateCustomerProfile(auth.shopifyCustomerId, {firstName, lastName});
      } catch (err) {
        getLogger().error({err}, "profile: shopify customer sync failed");
        return NextResponse.json(
          {error: "Your name was updated, but syncing it to your customer profile failed."},
          {status: 502},
        );
      }
    }

    return NextResponse.json({firstName, lastName});
  });
}
