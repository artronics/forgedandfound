import {getSecret} from "@forgedandfound/secret-manager";
import * as process from "node:process";

const SHOPIFY_SECRET_NAME = process.env.SHOPIFY_SECRET_NAME ?? "forgedandfound/infra/shopify";

interface ShopifySecret {
  store_name: string;
  app_client_id: string;
  app_client_secret: string;
  api_version: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

interface CachedToken {
  access_token: string;
  expiresAt: number; // epoch ms
}

// Module-level cache — survives Lambda warm invocations
let cachedSecret: ShopifySecret | null = null;
let cachedToken: CachedToken | null = null;

async function getShopifySecret(): Promise<ShopifySecret> {
  if (!cachedSecret) {
    cachedSecret = await getSecret<ShopifySecret>(SHOPIFY_SECRET_NAME);
  }
  return cachedSecret;
}

/**
 * Returns a valid Admin API access token, refreshing via client credentials
 * when the cached token is missing or within 60 s of expiry.
 */
export async function getAdminAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.access_token;
  }

  const { store_name, app_client_id, app_client_secret } = await getShopifySecret();

  const res = await fetch(`https://${store_name}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: app_client_id,
      client_secret: app_client_secret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  const ttl = (data.expires_in ?? 3600) * 1000;
  cachedToken = { access_token: data.access_token, expiresAt: now + ttl };

  return data.access_token;
}

/** Returns the Admin GraphQL endpoint for the configured store and API version. */
export async function getAdminGraphqlUrl(): Promise<string> {
  const { store_name, api_version } = await getShopifySecret();
  return `https://${store_name}.myshopify.com/admin/api/${api_version}/graphql.json`;
}
