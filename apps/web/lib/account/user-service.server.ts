import "server-only";
import {getLogger} from "@forgedandfound/logger/web";
import {userApi} from "@/lib/env";

export interface PatchUserBody {
  email?: string;
  firstName?: string;
  lastName?: string;
  acceptsMarketing?: boolean;
}

export interface UserServiceResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * PATCH /user/{sub} on the user-service Lambda (via API Gateway). Admin-side
 * Cognito writes live there — the web app on Vercel has no AWS credentials.
 * The caller's fresh ID token authorizes the request; the Lambda enforces that
 * the token's sub matches the path.
 */
export async function patchUser(
  sub: string,
  idToken: string,
  body: PatchUserBody,
): Promise<UserServiceResult> {
  let res: Response;
  try {
    res = await fetch(`${userApi.url}/user/${encodeURIComponent(sub)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: idToken,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    getLogger().error({err}, "user-service unreachable");
    return {ok: false, status: 502, error: "Could not update your account. Please try again."};
  }

  if (res.ok) return {ok: true, status: res.status};

  const data = (await res.json().catch(() => ({}))) as { error?: string };
  getLogger().warn({status: res.status, error: data.error}, "user-service update rejected");
  return {
    ok: false,
    status: res.status,
    error: data.error ?? "Could not update your account. Please try again.",
  };
}
