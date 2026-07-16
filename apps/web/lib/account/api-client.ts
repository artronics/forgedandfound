import "server-only";
import {account_api} from "@/lib/env";
import {getM2mAccessToken} from "./m2m-token";

/**
 * Server-only fetch against the internal account API. Attaches the
 * machine-to-machine bearer token; callers pass the authenticated user's id in
 * the path (the M2M token has no user identity of its own).
 */
export async function accountApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getM2mAccessToken();

  return fetch(`${account_api.url}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}
