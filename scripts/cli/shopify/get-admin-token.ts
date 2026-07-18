import {shopify} from "../../env";
import {getClientCredentialsToken} from "../../src/client-credentials";

export async function getAdminToken() {
  const result = await getClientCredentialsToken(
    shopify.tokenUrl,
    shopify.appClientId,
    shopify.appClientSecret,
  );

  console.log(result.access_token);
}