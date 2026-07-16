import "server-only";
import {account_api} from "@/lib/env";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CachedToken {
  access_token: string;
  expiresAt: number; // epoch ms
}

// Module-level cache — survives across requests on a warm server instance.
let cachedToken: CachedToken | null = null;

/**
 * Returns a valid client-credentials access token for the internal account API,
 * refreshing via Cognito's token endpoint when missing or within 60s of expiry.
 * Mirrors the Shopify admin token cache in lib/shopify/admin/admin-auth.ts.
 */
export async function getM2mAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.access_token;
  }

  const basic = Buffer.from(
    `${account_api.m2mClientId}:${account_api.m2mClientSecret}`,
  ).toString("base64");

  const res = await fetch(account_api.tokenUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: account_api.scope,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M2M token request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  cachedToken = {
    access_token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}
