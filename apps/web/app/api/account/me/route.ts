import {NextRequest, NextResponse} from "next/server";
import {getLogger, withWebLogger} from "@forgedandfound/logger/web";
import {getAccountAuth} from "@/lib/account/session.server";
import {getCustomerProfile} from "@/lib/shopify/admin/customer";

export interface AccountMe {
  firstName: string;
  lastName: string;
  /** null when the account has no real address (social placeholder). */
  email: string | null;
  /** Federated (social) users can't change email/password here. */
  isSocial: boolean;
  /** null when consent is unknown (no Shopify customer, or the lookup failed). */
  acceptsMarketing: boolean | null;
}

/**
 * The signed-in user's account profile. Name and email come from the fresh
 * Cognito ID token (the source of truth); marketing consent from the linked
 * Shopify customer, where it operationally lives.
 */
export async function GET(req: NextRequest) {
  return withWebLogger(req, async () => {
    const auth = await getAccountAuth(req);
    if (!auth) {
      return NextResponse.json({error: "Not signed in."}, {status: 401});
    }

    const {claims} = auth;

    let acceptsMarketing: boolean | null = null;
    if (auth.shopifyCustomerId) {
      try {
        const customer = await getCustomerProfile(auth.shopifyCustomerId);
        const state = customer?.emailMarketingConsent?.marketingState;
        if (state) acceptsMarketing = state === "SUBSCRIBED";
      } catch (err) {
        // Non-fatal: the rest of the page still works, consent shows as unknown.
        getLogger().warn({err}, "account: shopify consent lookup failed");
      }
    }

    const me: AccountMe = {
      // Social IdPs may provide a single `name` with no given/family split —
      // in that case the whole thing is treated as the first name.
      firstName: claims.given_name ?? claims.name ?? "",
      lastName: claims.family_name ?? "",
      email: auth.emailPlaceholder ? null : claims.email ?? null,
      isSocial: auth.isSocial,
      acceptsMarketing,
    };

    return NextResponse.json(me);
  });
}
