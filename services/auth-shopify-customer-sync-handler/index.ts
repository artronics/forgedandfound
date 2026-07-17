// TODO: When user uses both email/pass (cognito idp) and social ones there is no consolidation logic.
import crypto from "node:crypto";
import {
  AdminCreateUserCommand,
  AdminLinkProviderForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type {CreateCustomerInput, UpdateCustomerInput} from "@forgedandfound/shopify-admin-client/customer";
import {
  createCustomer,
  findCustomerByEmail,
  updateCustomer,
  updateCustomerEmailMarketingConsent,
} from "@forgedandfound/shopify-admin-client/customer";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {Context} from "aws-lambda";
import {getLogger} from "@forgedandfound/logger";

const cognito = new CognitoIdentityProviderClient({});

const PLACEHOLDER_EMAIL_DOMAIN = process.env.PLACEHOLDER_EMAIL_DOMAIN!;

/**
 * Thrown (deliberately) after a successful AdminLinkProviderForUser to abort the
 * sign-in that triggered the linking. Cognito mints the tokens for THIS sign-in
 * from the transient federated identity whose sub is never persisted — a session
 * built on them fails every user-pool operation with UserNotFoundException. By
 * failing this sign-in, the client retries and the retry resolves the linked
 * identity to the native user, issuing tokens with the real sub. The web app
 * auto-retries when it sees this marker (see apps/web LoginForm).
 */
class AccountLinkedRetryError extends Error {
  constructor() {
    super("ACCOUNT_LINKED_RETRY");
    this.name = "AccountLinkedRetryError";
  }
}

interface PostConfirmationEvent {
  triggerSource: "PostConfirmation_ConfirmSignUp" | "PostConfirmation_ConfirmForgotPassword";
  userPoolId: string;
  userName: string;
  request: {
    userAttributes: {
      sub: string;
      email: string;
      given_name?: string;
      family_name?: string;
      [key: string]: string | undefined;
    };
  };
  response: Record<string, never>;
}

/**
 * Fires before Cognito creates a user. For `PreSignUp_ExternalProvider` (a first
 * social sign-in) `userName` is `<Provider>_<providerUserId>`, e.g. `Google_123`.
 */
interface PreSignUpEvent {
  triggerSource: "PreSignUp_SignUp" | "PreSignUp_ExternalProvider" | "PreSignUp_AdminCreateUser";
  userPoolId: string;
  userName: string;
  request: {
    userAttributes: {
      email?: string;
      [key: string]: string | undefined;
    };
  };
  response: {
    autoConfirmUser?: boolean;
    autoVerifyEmail?: boolean;
    autoVerifyPhone?: boolean;
  };
}

type Event = PostConfirmationEvent | PreSignUpEvent;

async function createShopifyCustomer(
  email: string,
  attributes: {
    firstName?: string,
    lastName?: string,
    name?: string,
    phone?: string,
    acceptsMarketing?: boolean,
  },
): Promise<string | null> {
  const logger = getLogger();
  const {firstName, lastName, name, phone, acceptsMarketing} = attributes;
  const resolvedFirstName = firstName ?? name ?? "";

  const emailMarketingConsent: NonNullable<CreateCustomerInput["emailMarketingConsent"]> = acceptsMarketing
    ? {
      marketingState: "SUBSCRIBED",
      marketingOptInLevel: "SINGLE_OPT_IN",
      consentUpdatedAt: new Date().toISOString(),
    }
    : {
      marketingState: "NOT_SUBSCRIBED",
    };

  const {customer, userErrors} = (
    await createCustomer({
      email,
      firstName: resolvedFirstName,
      lastName: lastName ?? "",
      phone: phone ?? "",
      emailMarketingConsent,
    })
  ).customerCreate;

  if (userErrors.length) {
    if (userErrors.some(e => e.message.toLowerCase().includes("email has already been taken"))) {
      // A customer already exists (e.g. created during a social login). This
      // email/password registration is the source of truth, so update it with
      // the latest consent and — when provided — name/phone (never wipe existing
      // values with blanks).
      logger.warn("[EmailExists] Email already exists in Shopify; updating from this registration.");
      const existingId = await findCustomerIdByEmail(email);
      if (existingId) {
        await enrichExistingCustomer(existingId, {
          firstName: resolvedFirstName,
          lastName,
          phone,
          acceptsMarketing,
        });
      }
      return existingId;
    }
    const e = new Error(`Shopify customerCreate errors: ${JSON.stringify(userErrors)}`);
    logger.error(e);
    throw e;
  }

  return customer!.id;
}

/**
 * Apply this registration's details to a Shopify customer that already exists
 * (e.g. created by an earlier social login). Best-effort: this is enrichment, so
 * a failure here must never break sign-up/sign-in — the Cognito↔Shopify link is
 * the part that matters.
 */
async function enrichExistingCustomer(
  customerId: string,
  attributes: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    acceptsMarketing?: boolean;
  },
): Promise<void> {
  const logger = getLogger();
  const {firstName, lastName, phone, acceptsMarketing} = attributes;

  // Name/phone go through customerUpdate. Only send what we actually have, so we
  // never blank out existing values.
  const update: UpdateCustomerInput = {};
  if (firstName) update.firstName = firstName;
  if (lastName) update.lastName = lastName;
  if (phone) update.phone = phone;

  if (Object.keys(update).length > 0) {
    try {
      const {userErrors} = (await updateCustomer(customerId, update)).customerUpdate;
      if (userErrors.length) {
        logger.error({userErrors}, "[EmailExists] failed to update existing Shopify customer");
      }
    } catch (err) {
      logger.error({err}, "[EmailExists] customerUpdate threw (non-fatal)");
    }
  }

  // Consent only ever opts *in* on an existing customer: an unticked box means
  // "didn't opt in", not "unsubscribe me", so we leave their current consent
  // alone. (Shopify also rejects NOT_SUBSCRIBED as an update input.)
  if (!acceptsMarketing) return;

  try {
    const {userErrors} = (
      await updateCustomerEmailMarketingConsent(customerId, {
        marketingState: "SUBSCRIBED",
        marketingOptInLevel: "SINGLE_OPT_IN",
        consentUpdatedAt: new Date().toISOString(),
      })
    ).customerEmailMarketingConsentUpdate;
    if (userErrors.length) {
      logger.error({userErrors}, "[EmailExists] failed to update marketing consent");
    }
  } catch (err) {
    logger.error({err}, "[EmailExists] marketing consent update threw (non-fatal)");
  }
}

async function findCustomerIdByEmail(
  email: string,
): Promise<string | null> {
  const res = await findCustomerByEmail(email);
  return res?.id ?? null;
}

async function saveShopifyIdToCognito(
  userPoolId: string,
  userName: string,
  shopifyCustomerId: string,
): Promise<void> {
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: userName,
      UserAttributes: [{Name: "custom:shopify_customer_id", Value: shopifyCustomerId}],
    }),
  );
}


const APPLE_RELAY_SUFFIX = "@privaterelay.appleid.com";

/** Split `Google_123` / `SignInWithApple_abc` into provider and provider user id. */
function parseExternalUserName(userName: string): { providerName: string; providerUserId: string } | null {
  const separator = userName.indexOf("_");
  if (separator < 0) return null;
  return {
    providerName: userName.slice(0, separator),
    providerUserId: userName.slice(separator + 1),
  };
}

/**
 * A synthetic, undeliverable address for providers that give us no email (e.g.
 * Facebook). Keyed on the provider identity because the Cognito sub doesn't
 * exist yet at PreSignUp time. Exists so every user can have a Shopify customer.
 */
function placeholderEmail(providerName: string, providerUserId: string): string {
  return `unknown-${providerName.toLowerCase()}-${providerUserId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** Find a native (non-federated) user for this email, if one exists. */
async function findNativeUserByEmail(userPoolId: string, email: string) {
  // The filter value is a quoted string and the address came from an external
  // IdP — strip anything that could break out of the quotes.
  const safeEmail = email.replace(/["\\]/g, "");
  const {Users} = await cognito.send(
    new ListUsersCommand({UserPoolId: userPoolId, Filter: `email = "${safeEmail}"`}),
  );
  // Only ever link into a CONFIRMED native user whose email is verified —
  // otherwise someone could pre-register an unverified account on somebody
  // else's address and have their social sign-in merged into it.
  return (Users ?? []).find(
    (u) =>
      u.UserStatus === "CONFIRMED" &&
      u.Attributes?.some((a) => a.Name === "email_verified" && a.Value === "true"),
  );
}

/**
 * Create the native account that a social identity will hang off. Every user
 * gets one so there's a single source of truth to sync Shopify from.
 *
 * The user never knows this password — they'd use "reset password" to set one.
 * Names are deliberately not copied from the provider: the user supplies their
 * name in our UI (and IdP attribute mapping would otherwise overwrite it).
 */
async function createNativeUser(
  userPoolId: string,
  email: string,
  isPlaceholder: boolean,
): Promise<string> {
  const {User} = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      // Suppress the invite — this account is created on the user's behalf.
      MessageAction: "SUPPRESS",
      UserAttributes: [
        {Name: "email", Value: email},
        // A real provider email is already verified by the provider; a
        // placeholder is not a real address the user owns.
        {Name: "email_verified", Value: isPlaceholder ? "false" : "true"},
        {Name: "custom:email_placeholder", Value: isPlaceholder ? "true" : "false"},
      ],
    }),
  );

  const username = User!.Username!;

  // AdminCreateUser leaves the user in FORCE_CHANGE_PASSWORD; a permanent random
  // password moves them to CONFIRMED so the account behaves like any other.
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: `${crypto.randomUUID()}Aa1!`,
      Permanent: true,
    }),
  );

  return username;
}

/**
 * First social sign-in. Ensure a native account exists for this person, give it
 * a Shopify customer, then link the social identity into it — all before Cognito
 * creates a federated user, which is the only ordering AdminLinkProviderForUser
 * properly supports.
 *
 * Best-effort: on failure we let the sign-in proceed rather than locking the
 * user out (they'd get a standalone federated user we can reconcile later).
 */
async function linkExternalProviderToNativeUser(e: PreSignUpEvent): Promise<void> {
  const logger = getLogger();

  const parsed = parseExternalUserName(e.userName);
  if (!parsed) {
    logger.warn({userName: e.userName}, "[PreSignUp] unexpected external username format");
    return;
  }
  const {providerName, providerUserId} = parsed;

  const providerEmail = e.request.userAttributes.email;
  // Only trust an address the provider itself verified (mapped from the IdP's
  // email_verified claim — Google and Apple send it; Facebook doesn't). An
  // unverified claim could be someone else's address: matching or creating a
  // native account on it would let an attacker link into a victim's account.
  const providerEmailVerified = e.request.userAttributes.email_verified === "true";
  // Apple relay addresses are real but we treat them as placeholders: they're not
  // an address we show or ask the user to rely on.
  const isPlaceholder =
    !providerEmail ||
    !providerEmailVerified ||
    providerEmail.toLowerCase().endsWith(APPLE_RELAY_SUFFIX);
  const email = providerEmail ?? placeholderEmail(providerName, providerUserId);

  // An existing native account only matters for a real address — placeholders are
  // unique per identity by construction.
  const existing = isPlaceholder ? undefined : await findNativeUserByEmail(e.userPoolId, email);
  let nativeUsername = existing?.Username;

  if (!nativeUsername) {
    nativeUsername = await createNativeUser(e.userPoolId, email, isPlaceholder);
    logger.info({provider: providerName, isPlaceholder}, "[PreSignUp] created native user for social sign-in");

    const shopifyCustomerId = await createShopifyCustomer(email, {});
    if (shopifyCustomerId) {
      await saveShopifyIdToCognito(e.userPoolId, nativeUsername, shopifyCustomerId);
    } else {
      logger.warn("[PreSignUp] could not create a Shopify customer for the new native user");
    }
  }

  await cognito.send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: e.userPoolId,
      DestinationUser: {ProviderName: "Cognito", ProviderAttributeValue: nativeUsername},
      SourceUser: {
        ProviderName: providerName,
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: providerUserId,
      },
    }),
  );
  logger.info({provider: providerName}, "[PreSignUp] linked social identity into native user");

  // NOTE: Cognito re-applies the IdP attribute mapping to the linked native user
  // on every federated sign-in, stamping email_verified=false unless the
  // provider's email_verified claim is mapped through (see terraform/auth/idp.tf,
  // which maps it for Google and Apple). Providers without the claim (Facebook)
  // are treated as placeholders above, so their native user correctly stays
  // unverified until the user adds an email themselves.

  // The linking sign-in itself must not complete — its tokens would carry a
  // ghost sub. Abort it; the client auto-retries into the linked native user.
  throw new AccountLinkedRetryError();
}

export const handler = async (event: Event, context: Context): Promise<Event> => {
  return withLambdaLogger(context, async () => {
    return await authHandler(event);
  });
};

const authHandler = async (event: Event): Promise<Event> => {
  const logger = getLogger();

  // A first social sign-in: link it to an existing native account if there is
  // one. Never touches the normal PreSignUp_SignUp path — that must keep its
  // email verification, so we return the event untouched.
  if (event.triggerSource === "PreSignUp_ExternalProvider") {
    try {
      await linkExternalProviderToNativeUser(event as PreSignUpEvent);
    } catch (err) {
      // A successful link aborts this sign-in on purpose — the client retries
      // and signs into the native user with a real sub. Everything else stays
      // best-effort: the sign-in proceeds rather than locking the user out.
      if (err instanceof AccountLinkedRetryError) throw err;
      logger.error({err}, "[PreSignUp] linking social identity failed (non-fatal)");
    }
    return event;
  }

  const e = event as PostConfirmationEvent;
  if (e.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    logger.info({triggerSource: e.triggerSource}, "no handler for trigger: skipping");
    return event;
  }
  const userPoolId = e.userPoolId;
  const userName = e.userName;
  const email = e.request.userAttributes.email;
  const firstName = e.request.userAttributes.given_name;
  const lastName = e.request.userAttributes.family_name;
  const name = e.request.userAttributes.name;
  const phone = e.request.userAttributes.phone_number;
  const acceptsMarketing = e.request.userAttributes["custom:accepts_marketing"] === "true";

  if (!email) {
    logger.warn("[MissingEmail] No email on user attributes, skipping Shopify customer creation.");
    logger.debug(e, "skipping Shopify customer creation");
    return event;
  }

  // Accounts created by the account-service (social users adding an email) carry
  // an existing Shopify customer id; that service owns the Shopify update, so
  // skip here to avoid creating a duplicate customer.
  if (e.request.userAttributes["custom:shopify_customer_id"]) {
    logger.info("shopify customer id already present, skipping creation");
    return event;
  }

  const shopifyCustomerId = await createShopifyCustomer(email, {firstName, lastName, name, phone, acceptsMarketing});
  if (shopifyCustomerId === null) {
    logger.warn("[ShopifyCustomerCreationFailed] Failed to create Shopify customer, skipping.");
    return event;
  }

  await saveShopifyIdToCognito(userPoolId, userName, shopifyCustomerId);
  logger.info("shopify customer ID has been synced successfully");

  return event;
};

