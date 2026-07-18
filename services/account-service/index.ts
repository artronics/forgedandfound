import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from "aws-lambda";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {getLogger} from "@forgedandfound/logger";
import {
  createCustomerAddress,
  requestCustomerDataErasure,
  updateCustomer,
  updateCustomerEmail,
} from "@forgedandfound/shopify-admin-client/customer";
import {
  clearEmailPlaceholder,
  deleteUser,
  findUserByEmail,
  getPoolUser,
  linkProvider,
  setPassword,
  setVerifiedEmail,
  unlinkProvider,
  updateName,
} from "./cognito";
import {
  notifyPasswordChanged,
  sendEmailChangeVerification,
  sendLinkAccountsEmail,
} from "./notifications";
import {signEmailToken, verifyEmailToken} from "./tokens";

const APP_URL = process.env.APP_URL!;
// Origins we're willing to put in emailed links; anything else falls back to
// APP_URL so a crafted request body can't point our email at another domain.
const ALLOWED_APP_ORIGINS = (process.env.ALLOWED_APP_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function resolveAppOrigin(requested?: string): string {
  if (!requested) return APP_URL;
  const normalised = requested.trim().replace(/\/+$/, "");
  return ALLOWED_APP_ORIGINS.includes(normalised) ? normalised : APP_URL;
}

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
 * Begin an add/change-email flow. Nothing is written to Cognito here — we email
 * a signed link and the change is applied only when it's confirmed:
 *
 * - Address is free → "change": verification link to the new address; on
 *   confirm it replaces the current (or placeholder) email, already verified.
 * - Address belongs to another CONFIRMED, verified account → "merge": approval
 *   link to that address; on confirm (signed in as that account) the caller's
 *   social identities are linked into it and the caller's leftover account is
 *   removed. This is how a Facebook/Apple placeholder account consolidates with
 *   an existing email or Google account.
 */
async function startEmail(
  identity: Identity,
  body: { email?: string; origin?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  const email = body.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return json(400, {error: "A valid email is required."});
  }
  if (!identity.sub) {
    return json(401, {error: "Not signed in."});
  }

  const origin = resolveAppOrigin(body.origin);
  const holder = await findUserByEmail(email);

  if (holder && holder.username !== identity.sub) {
    // Only a fully-owned address can absorb new sign-ins.
    if (holder.status !== "CONFIRMED" || !holder.emailVerified) {
      return json(409, {error: "That email is already in use."});
    }
    const token = signEmailToken({
      action: "merge",
      sub: identity.sub,
      email,
      targetSub: holder.username,
    });
    await sendLinkAccountsEmail(email, buildVerifyUrl(origin, token));
    logger.info("start-email: merge link sent");
    return json(200, {verificationRequired: true});
  }

  const token = signEmailToken({action: "change", sub: identity.sub, email});
  await sendEmailChangeVerification(email, buildVerifyUrl(origin, token));
  logger.info("start-email: change verification sent");
  return json(200, {verificationRequired: true});
}

function buildVerifyUrl(origin: string, token: string): string {
  const url = new URL("/account/verify-email", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Complete an email change or an account merge from the emailed signed token.
 * The token proves the email was received; the session (enforced against the
 * sub inside the token) proves who's acting — a stray click on the link alone
 * can never change or hand over an account.
 */
async function verifyEmail(
  identity: Identity,
  body: { token?: string },
): Promise<APIGatewayProxyResult> {
  const logger = getLogger();

  if (!identity.sub) {
    return json(401, {error: "Not signed in."});
  }
  const payload = body.token ? verifyEmailToken(body.token) : null;
  if (!payload) {
    return json(400, {error: "This verification link is invalid or has expired."});
  }

  if (payload.action === "change") {
    if (payload.sub !== identity.sub) {
      return json(403, {
        error: "This link was requested from a different account. Sign in with that account to finish.",
        code: "WRONG_ACCOUNT",
      });
    }

    try {
      await setVerifiedEmail(identity.sub, payload.email);
    } catch (err) {
      logger.warn({err}, "account verify: setVerifiedEmail failed");
      if (errName(err) === "AliasExistsException") {
        return json(409, {error: "That email is already in use by another account."});
      }
      return json(500, {error: "Could not verify your email."});
    }
    await clearEmailPlaceholder(identity.sub);

    // Mirror the verified address to Shopify — it comes from the signed token,
    // never from a client-editable field.
    if (identity.shopifyCustomerId) {
      const {userErrors} = (
        await updateCustomerEmail(identity.shopifyCustomerId, payload.email)
      ).customerUpdate;
      if (userErrors.length) {
        logger.error({userErrors}, "account verify: shopify customerUpdate failed");
        return json(502, {error: "Email verified, but updating your customer profile failed."});
      }
    }

    return json(200, {ok: true, email: payload.email});
  }

  // Merge: must be approved by the OWNER of the target account.
  if (payload.targetSub !== identity.sub) {
    // If the target account no longer exists (deleted or re-created since the
    // email was sent), no sign-in can ever approve this link — say so instead
    // of sending the user hunting for the "right" account.
    const target = await getPoolUser(payload.targetSub).catch(() => null);
    if (!target) {
      return json(400, {error: "This link is no longer valid. Request a new one from your account page."});
    }
    return json(403, {
      error: "To approve this, sign in with the account this email belongs to.",
      code: "WRONG_ACCOUNT",
    });
  }

  const source = await getPoolUser(payload.sub).catch(() => null);
  if (!source) {
    // The requesting account is gone — nothing left to merge.
    return json(400, {error: "This link is no longer valid."});
  }

  // Move every social identity from the leftover account onto this one.
  for (const id of source.identities) {
    await unlinkProvider(id.providerName, id.userId);
    await linkProvider(identity.sub, id.providerName, id.userId);
    logger.info({provider: id.providerName}, "merge: relinked identity");
  }

  // The leftover account and its placeholder Shopify customer are retired.
  const target = await getPoolUser(identity.sub).catch(() => null);
  if (source.shopifyCustomerId && source.shopifyCustomerId !== target?.shopifyCustomerId) {
    try {
      const {userErrors} = (
        await requestCustomerDataErasure(source.shopifyCustomerId)
      ).customerRequestDataErasure;
      if (userErrors.length) {
        logger.error({userErrors}, "merge: shopify erasure of leftover customer failed");
      }
    } catch (err) {
      logger.error({err}, "merge: shopify erasure threw (non-fatal)");
    }
  }
  await deleteUser(payload.sub);
  logger.info("merge: leftover account removed");

  return json(200, {merged: true});
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
    getLogger().warn({err, sub: identity.sub}, "set password failed");
    switch (errName(err)) {
      case "InvalidPasswordException":
        return json(400, {error: "Password does not meet the requirements."});
      // The session outlived its Cognito user (deleted account, or a ghost
      // federated session) — a fresh sign-in is the only remedy.
      case "UserNotFoundException":
        return json(401, {error: "Your session is no longer valid. Please sign out and sign in again."});
      default:
        return json(500, {error: "Could not set your password."});
    }
  }

  // Security notification — the owner must hear about a password change they
  // didn't make. Best-effort; never fails the operation.
  await notifyPasswordChanged(identity.sub);

  return json(200, {ok: true});
}

/**
 * Permanently delete the user's Cognito account and queue erasure of their
 * Shopify customer data — the UI promises "all associated data", and the
 * Shopify record holds the PII (name, addresses, phone).
 */
async function deleteAccount(identity: Identity): Promise<APIGatewayProxyResult> {
  const logger = getLogger();
  if (!identity.sub) {
    return json(400, {error: "Missing user id."});
  }

  // Best-effort: the Cognito deletion must not be blocked by a Shopify hiccup.
  // customerRequestDataErasure works even when the customer has orders (Shopify
  // redacts after its retention window).
  if (identity.shopifyCustomerId) {
    try {
      const {userErrors} = (
        await requestCustomerDataErasure(identity.shopifyCustomerId)
      ).customerRequestDataErasure;
      if (userErrors.length) {
        logger.error({userErrors}, "delete: shopify data-erasure request failed");
      }
    } catch (err) {
      logger.error({err}, "delete: shopify data-erasure request threw (non-fatal)");
    }
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
