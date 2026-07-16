import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {getLogger} from "@forgedandfound/logger";
import {
  createCustomerAddress,
  updateCustomer,
  updateCustomerEmail,
} from "@forgedandfound/shopify-admin-client/customer";
import {
  confirmSignUp,
  deleteUser,
  forgotPassword,
  getUsername,
  getUsernameBySub,
  linkProvider,
  signUp,
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
      return passwordReset(identity);
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
  body: { email?: string; password?: string; origin?: string; returnTo?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return json(400, {error: "Email and password are required."});
  }

  const clientMetadata: Record<string, string> = {flow: "account-email"};
  if (body.origin) clientMetadata.origin = body.origin;
  if (body.returnTo) clientMetadata.returnTo = body.returnTo;

  try {
    await signUp(email, password, identity.shopifyCustomerId, clientMetadata);
    return json(200, {verificationRequired: true});
  } catch (err) {
    logger.warn({err}, "account start-email failed");
    switch (errName(err)) {
      case "UsernameExistsException":
        return json(409, {error: "That email is already registered."});
      case "InvalidPasswordException":
        return json(400, {error: "Password does not meet the requirements."});
      case "InvalidParameterException":
        return json(400, {error: "Invalid email or password."});
      default:
        return json(500, {error: "Could not start email verification."});
    }
  }
}

/**
 * Confirm the emailed code, then apply: link the caller's federated identity
 * into the new native account and propagate the email to Shopify.
 */
async function verifyEmail(
  identity: Identity,
  body: { email?: string; code?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  const email = body.email?.trim();
  const code = body.code?.trim();

  if (!email || !code) {
    return json(400, {error: "Email and code are required."});
  }

  // 1. Confirm the code. Already-confirmed is fine (idempotent re-submits).
  try {
    await confirmSignUp(email, code);
  } catch (err) {
    const name = errName(err);
    const alreadyConfirmed =
      name === "NotAuthorizedException" &&
      /status is confirmed/i.test((err as { message?: string })?.message ?? "");
    if (!alreadyConfirmed) {
      logger.warn({err}, "account verify: confirmSignUp failed");
      if (name === "CodeMismatchException" || name === "ExpiredCodeException") {
        return json(400, {error: "This verification code is invalid or has expired."});
      }
      return json(400, {error: "Could not verify your email."});
    }
  }

  const nativeUsername = await getUsername(email);

  // 2. Link the federated identity into the native account (best-effort;
  //    already-linked is not an error).
  if (identity.provider && identity.providerUserId) {
    try {
      await linkProvider(nativeUsername, identity.provider, identity.providerUserId);
    } catch (err) {
      const name = errName(err);
      if (name !== "InvalidParameterException" && name !== "AliasExistsException") {
        logger.error({err}, "account verify: linkProvider failed");
        throw err;
      }
      logger.info({name}, "account verify: identity already linked, continuing");
    }
  }

  // 3. Propagate to Shopify. When a customer id was carried, update it here; the
  //    post-confirmation Lambda skips creation in that case. When absent, that
  //    Lambda creates + links the customer, so nothing to do here.
  if (identity.shopifyCustomerId) {
    const {userErrors} = (await updateCustomerEmail(identity.shopifyCustomerId, email)).customerUpdate;
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

  const username = await getUsernameBySub(identity.sub);
  if (!username) {
    return json(404, {error: "User not found."});
  }

  await updateName(username, name);

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

/** Start a self-service password reset (Cognito emails a reset link). */
async function passwordReset(identity: Identity): Promise<APIGatewayProxyResult> {
  if (!identity.email) {
    return json(400, {error: "No email on file to reset."});
  }

  try {
    await forgotPassword(identity.email);
  } catch (err) {
    // Swallow to avoid revealing whether an account exists; still report generic ok.
    getLogger().warn({err}, "password reset request failed");
    if (errName(err) === "LimitExceededException") {
      return json(429, {error: "Too many attempts. Please try again later."});
    }
  }
  return json(200, {sent: true});
}

/** Permanently delete the user's Cognito account. */
async function deleteAccount(identity: Identity): Promise<APIGatewayProxyResult> {
  if (!identity.sub) {
    return json(400, {error: "Missing user id."});
  }

  const username = await getUsernameBySub(identity.sub);
  if (!username) {
    // Nothing to delete — treat as success so the client can proceed to sign-out.
    return json(200, {deleted: true});
  }

  await deleteUser(username);
  return json(200, {deleted: true});
}
