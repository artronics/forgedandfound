import {getAdminAccessToken} from "@forgedandfound/shopify-admin-client/client";

import {shopify} from "../../env.ts";
import {info} from "../log.ts";

export async function getAdminToken() {
  info(`Requesting Shopify admin token for ${shopify.shopDomain}`);

  // Only the raw token on stdout, so `ff shopify get-admin-token` can be piped.
  // Auth resolves via the shared client: env vars locally, Secrets Manager in AWS.
  console.log(await getAdminAccessToken());
}
