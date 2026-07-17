import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {getLogger} from "@forgedandfound/logger";
import {
  createCustomerAddress,
  updateCustomer,
  updateCustomerEmail,
} from "@forgedandfound/shopify-admin-client/customer";
import {
  clearEmailPlaceholder,
  confirmEmailChange,
  deleteUser,
  getEmail,
  requestEmailChange,
  setPassword,
  updateName,
} from "./cognito";

/**
 * The authenticated caller, forwarded by the Next.js BFF in X-User-* headers.
 * The M2M token has no user identity of its own, so the BFF (the only holder of
 * the token) attaches the verified session identity here.
 */
interface Identity {
  sub?: string;
  email?: string;
  shopifyCustomerId?: string;
  provider?: string;
  providerUserId?: string;
  /** The caller's own Cognito access token, for user-pool self-service APIs. */
  accessToken?: string;
}

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

function getIdentity(event: APIGatewayProxyEvent): Identity {
  const headers = event.headers ?? {};
  const get = (name: string): string | undefined => {
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
    return key ? headers[key] : undefined;
  };
  return {
    sub: get("x-user-id"),
    email: get("x-user-email"),
    shopifyCustomerId: get("x-shopify-customer-id"),
    provider: get("x-user-provider"),
    providerUserId: get("x-user-provider-id"),
    accessToken: get("x-cognito-access-token"),
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  return withLambdaLogger(context, async () => {
    return await accountService(event);
  });
};

const accountService = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const logger = getLogger();
  const body = event.body ? JSON.parse(event.body) : {};
  const identity = getIdentity(event);
  const proxy = event.pathParameters?.proxy ?? "";
  logger.debug({proxy, method: event.httpMethod}, "received event");

  switch (`${event.httpMethod} ${proxy}`) {
    case "POST email":
      return startEmail(identity, body);
    case "POST verify":
      return verifyEmail(identity, body);
    case "PATCH profile":
      return updateProfile(identity, body);
    case "POST addresses":
      return addAddress(identity, body);
    case "POST password":
      return changePassword(identity, body);
    case "POST delete":
      return deleteAccount(identity);
    default:
      return json(404, {error: "not found"});
  }
};

/**
 * Begin an add-email flow: create a native account for the new address. Cognito
 * emails the verification link; nothing is applied until it's confirmed.
 */
async function startEmail(
  identity: Identity,
  body: { email?: string; origin?: string; returnTo?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  const email = body.email?.trim();

  if (!email) {
    return json(400, {error: "Email is required."});
  }
  if (!identity.accessToken) {
    return json(401, {error: "Not signed in."});
  }

  const clientMetadata: Record<string, string> = {flow: "account-email"};
  if (body.origin) clientMetadata.origin = body.origin;
  if (body.returnTo) clientMetadata.returnTo = body.returnTo;

  try {
    await requestEmailChange(identity.accessToken, email, clientMetadata);
    return json(200, {verificationRequired: true});
  } catch (err) {
    logger.warn({err}, "account start-email failed");
    switch (errName(err)) {
      case "AliasExistsException":
      case "UsernameExistsException":
        return json(409, {error: "That email is already in use."});
      case "NotAuthorizedException":
        return json(401, {error: "Your session has expired. Please sign in again."});
      case "InvalidParameterException":
        return json(400, {error: "That email address isn't valid."});
      case "LimitExceededException":
        return json(429, {error: "Too many attempts. Please try again later."});
      default:
        return json(500, {error: "Could not start email verification."});
    }
  }
}

/**
 * Confirm the emailed code. Cognito marks the new email verified; we then clear
 * the placeholder marker and mirror the address to Shopify.
 *
 * Consent is deliberately NOT carried over here: a placeholder was never a real
 * address the user consented on, so they opt in fresh.
 */
async function verifyEmail(
  identity: Identity,
  body: { email?: string; code?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  const code = body.code?.trim();

  if (!code) {
    return json(400, {error: "Verification code is required."});
  }
  if (!identity.accessToken || !identity.sub) {
    return json(401, {error: "Not signed in."});
  }

  try {
    await confirmEmailChange(identity.accessToken, code);
  } catch (err) {
    const name = errName(err);
    logger.warn({err}, "account verify: confirmEmailChange failed");
    switch (name) {
      case "CodeMismatchException":
      case "ExpiredCodeException":
        return json(400, {error: "This verification code is invalid or has expired."});
      case "NotAuthorizedException":
        return json(401, {error: "Your session has expired. Please sign in again."});
      default:
        return json(400, {error: "Could not verify your email."});
    }
  }

  await clearEmailPlaceholder(identity.sub);

  // Mirror to Shopify. The customer already exists (created against the
  // placeholder address when the account was made), so this is an update. The
  // address is read back from Cognito — the body's email is never trusted, or a
  // caller could attach an address they don't own to their customer record.
  const verifiedEmail = await getEmail(identity.accessToken);

  if (identity.shopifyCustomerId && verifiedEmail) {
    const {userErrors} = (await updateCustomerEmail(identity.shopifyCustomerId, verifiedEmail)).customerUpdate;
    if (userErrors.length) {
      logger.error({userErrors}, "account verify: shopify customerUpdate failed");
      return json(502, {error: "Email verified, but updating your customer profile failed."});
    }
  }

  return json(200, {ok: true});
}

/**
 * Update the user's name in Cognito, then mirror it to Shopify. Cognito native is
 * the source of truth; Shopify follows it.
 */
async function updateProfile(
  identity: Identity,
  body: { name?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  const name = body.name?.trim();

  if (!identity.sub || !name) {
    return json(400, {error: "Name is required."});
  }

  // In this pool the native user's Username is the sub, and Cognito's admin APIs
  // accept the sub as the Username for local users — so no lookup is needed.
  await updateName(identity.sub, name);

  if (identity.shopifyCustomerId) {
    const {userErrors} = (
      await updateCustomer(identity.shopifyCustomerId, {firstName: name, lastName: ""})
    ).customerUpdate;
    if (userErrors.length) {
      logger.error({userErrors}, "profile: shopify customerUpdate failed");
      return json(502, {error: "Name updated, but syncing to your customer profile failed."});
    }
  }

  return json(200, {name});
}

/** Add an address to the user's Shopify customer record. */
async function addAddress(
  identity: Identity,
  body: Record<string, string>,
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();

  if (!identity.shopifyCustomerId) {
    return json(400, {error: "No linked customer to add an address to."});
  }
  if (!body.line1 || !body.city || !body.postalCode || !body.country) {
    return json(400, {error: "Address, city, postal code and country are required."});
  }

  const {customerAddress, userErrors} = (
    await createCustomerAddress(identity.shopifyCustomerId, {
      firstName: body.firstName,
      lastName: body.lastName,
      line1: body.line1,
      line2: body.line2,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      country: body.country,
      phone: body.phone,
    })
  ).customerAddressCreate;

  if (userErrors.length || !customerAddress) {
    logger.error({userErrors}, "address: shopify customerAddressCreate failed");
    return json(502, {error: "Could not save your address."});
  }

  return json(200, {address: {...body, id: customerAddress.id}});
}

/**
 * Set a new password for the signed-in user. Works for social users (who have no
 * usable password and can't use the email-reset flow because their linked
 * identity blocks email verification). The session is the proof of ownership, so
 * we don't require the current password — social users don't have one to give.
 */
async function changePassword(
  identity: Identity,
  body: { password?: string },
): Promise<APIGatewayProxyResult> {
  const password = body.password;

  if (!identity.sub) {
    return json(401, {error: "Not signed in."});
  }
  if (!password) {
    return json(400, {error: "A new password is required."});
  }

  try {
    await setPassword(identity.sub, password);
  } catch (err) {
    getLogger().warn({err}, "set password failed");
    if (errName(err) === "InvalidPasswordException") {
      return json(400, {error: "Password does not meet the requirements."});
    }
    return json(500, {error: "Could not set your password."});
  }

  return json(200, {ok: true});
}

/** Permanently delete the user's Cognito account. */
async function deleteAccount(identity: Identity): Promise<APIGatewayProxyResult> {
  if (!identity.sub) {
    return json(400, {error: "Missing user id."});
  }

  try {
    await deleteUser(identity.sub);
  } catch (err) {
    // Already gone — treat as success so the client can proceed to sign-out.
    if (errName(err) !== "UserNotFoundException") {
      getLogger().error({err}, "delete account failed");
      return json(500, {error: "Could not delete your account."});
    }
  }
  return json(200, {deleted: true});
}
