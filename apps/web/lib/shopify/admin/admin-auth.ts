"use server";

import {shopifyAdmin} from "@/lib/env";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

export async function getAdminAccessToken(): Promise<string> {
  const now = Date.now();

  if (
    cachedToken &&
    cachedToken.expiresAt > now + 60_000
  ) {
    return cachedToken.accessToken;
  }

  const response = await fetch(
    `${shopifyAdmin.url}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: shopifyAdmin.clientId,
        client_secret: shopifyAdmin.clientSecret,
        grant_type: "client_credentials",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Shopify token exchange failed: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as TokenResponse;
  const ttlMs = (data.expires_in ?? 3600) * 1000;

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + ttlMs,
  };

  return cachedToken.accessToken;
}
