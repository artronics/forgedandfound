import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  type AttributeType,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {getLogger} from "@forgedandfound/logger";

const cognito = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.USER_POOL_ID!;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  return withLambdaLogger(context, async () => {
    return await userService(event);
  });
};

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body),
  };
}

function errName(err: unknown): string | undefined {
  return (err as { name?: string })?.name;
}

interface PatchUserBody {
  firstName?: string;
  lastName?: string;
  acceptsMarketing?: boolean;
}

const userService = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const logger = getLogger();
  logger.debug({path: event.path, method: event.httpMethod}, "received event");

  switch (event.httpMethod) {
    case "PATCH":
      return patchUser(event);
    case "DELETE":
      return deleteUser(event);
    default:
      return json(404, {error: "Not found."});
  }
};

/**
 * The caller's Cognito identity from the API Gateway authorizer, having
 * verified the path id matches the token's own subject. Returns an error
 * response instead when the caller isn't signed in or is targeting another
 * user — the same guard both handlers need.
 */
function authorizeSelf(event: APIGatewayProxyEvent):
  | {claims: Record<string, string>; sub: string; username: string}
  | {error: APIGatewayProxyResult} {
  const claims = (event.requestContext.authorizer as
    | {claims?: Record<string, string>}
    | undefined)?.claims;
  const sub = claims?.sub;
  const id = event.pathParameters?.id;

  if (!sub) {
    return {error: json(401, {error: "Not signed in."})};
  }
  if (!id || id !== sub) {
    return {error: json(403, {error: "You can only update your own account."})};
  }
  // The admin APIs take the Username, not the sub — for federated users those
  // differ (`<Provider>_<id>`), so read it from the token.
  return {claims, sub, username: claims["cognito:username"] ?? sub};
}

/**
 * PATCH /user/{id} — update the caller's own Cognito profile. The API Gateway
 * Cognito authorizer has already verified the ID token; here we only enforce
 * that the token's subject matches the path (users can update themselves, not
 * each other), and apply the admin-side attribute writes the Vercel-hosted web
 * app can't perform itself.
 */
async function patchUser(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();

  const authorized = authorizeSelf(event);
  if ("error" in authorized) return authorized.error;
  const {username} = authorized;

  let body: PatchUserBody;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, {error: "Invalid request body."});
  }

  const attributes: AttributeType[] = [];

  if (body.firstName !== undefined) {
    attributes.push({Name: "given_name", Value: body.firstName.trim()});
  }
  if (body.lastName !== undefined) {
    attributes.push({Name: "family_name", Value: body.lastName.trim()});
  }
  if (body.acceptsMarketing !== undefined) {
    attributes.push({
      Name: "custom:accepts_marketing",
      Value: body.acceptsMarketing ? "true" : "false",
    });
  }

  // Email is deliberately NOT handled here. Changing it admin-side would force
  // email_verified=true on an unverified address — and since email is a sign-in
  // alias, that's an account-takeover vector. Email changes go through the
  // user's own access token via UpdateUserAttributes / VerifyUserAttribute (see
  // apps/web app/api/account/email/*), which makes Cognito verify the new
  // address before it becomes active.

  if (attributes.length === 0) {
    return json(400, {error: "Nothing to update."});
  }

  try {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: attributes,
      }),
    );
  } catch (err) {
    logger.warn({err, attributes: attributes.map((a) => a.Name)}, "user update failed");
    switch (errName(err)) {
      case "InvalidParameterException":
        return json(400, {error: "Invalid value."});
      case "UserNotFoundException":
        // The session outlived its user (deleted account) — only a fresh
        // sign-in can help.
        return json(401, {error: "Your session is no longer valid. Please sign in again."});
      default:
        return json(500, {error: "Could not update your account."});
    }
  }

  logger.info({attributes: attributes.map((a) => a.Name)}, "user updated");
  return json(200, {ok: true});
}

/**
 * Every Cognito Username whose `email` attribute exactly matches `email`.
 * Paginated because the pool holds every deployment's users. Filter values are
 * quoted; escape any `"`/`\` so an address can't break out of the filter.
 */
async function findUsernamesByEmail(email: string): Promise<string[]> {
  const escaped = email.replace(/(["\\])/g, "\\$1");
  const usernames: string[] = [];
  let paginationToken: string | undefined;

  do {
    const res = await cognito.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Filter: `email = "${escaped}"`,
        Limit: 60,
        PaginationToken: paginationToken,
      }),
    );
    for (const user of res.Users ?? []) {
      if (user.Username) usernames.push(user.Username);
    }
    paginationToken = res.PaginationToken;
  } while (paginationToken);

  return usernames;
}

/**
 * DELETE /user/{id} — permanently delete the caller's account. Uses the admin
 * API (not self-service DeleteUser) so it works for every sign-in kind:
 * hosted-UI/social access tokens lack the `aws.cognito.signin.user.admin` scope
 * that self-service DeleteUser requires.
 *
 * One person can hold more than one Cognito user for the same verified email —
 * e.g. a Google (federated) `Google_<id>` user AND a native email/password user
 * (the pool doesn't link them). They share a single Shopify customer. So a
 * delete must remove EVERY Cognito record for that email, not just the one the
 * caller signed in with; otherwise the other is orphaned and left pointing at a
 * now-deleted Shopify customer. The caller's token proves they own the email,
 * which is what authorises deleting its siblings.
 */
async function deleteUser(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();

  const authorized = authorizeSelf(event);
  if ("error" in authorized) return authorized.error;
  const {claims, username} = authorized;

  const email = claims.email?.trim().toLowerCase();

  let usernames: string[] = [];
  if (email) {
    try {
      usernames = await findUsernamesByEmail(email);
    } catch (err) {
      // Fall back to deleting just the caller below — a lookup failure must not
      // leave the account they explicitly asked to delete intact.
      logger.warn({err}, "listing users by email failed; deleting caller only");
    }
  }
  // Always include the caller's own user, even if the lookup missed it (e.g. a
  // differing email attribute) — its identity is proven by the token.
  if (!usernames.includes(username)) usernames.push(username);

  const failed: string[] = [];
  for (const name of usernames) {
    try {
      await cognito.send(
        new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: name,
        }),
      );
    } catch (err) {
      // Already gone (double-submit, or a prior partial delete) is fine.
      if (errName(err) === "UserNotFoundException") continue;
      logger.error({err}, "user deletion failed");
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    return json(500, {error: "Could not delete your account."});
  }

  logger.info({count: usernames.length}, "user(s) deleted");
  return json(200, {ok: true});
}
