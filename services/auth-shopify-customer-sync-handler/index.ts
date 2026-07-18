// NOTE: Social users are standalone federated users (Google_…, Facebook_…) —
// one account per provider, deliberately separate from any email/password
// account with the same address. Do not add AdminLinkProviderForUser-based
// consolidation here; that approach was tried and abandoned (ghost sessions,
// trigger-retry aborts, hosted-UI session staleness).
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import {renderPasswordChangedEmail} from "@forgedandfound/email/emails";
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
const ses = new SESv2Client({});

const PLACEHOLDER_EMAIL_DOMAIN = process.env.PLACEHOLDER_EMAIL_DOMAIN!;
const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS;
const SES_CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET;

const APPLE_RELAY_SUFFIX = "@privaterelay.appleid.com";

// Cognito gives a Lambda trigger 5 seconds total; a timeout fails the trigger
// and with it the user's first social sign-in. Shopify round-trips have been
// measured at 3.7–4.3s cold, so bound the work and bail rather than risk it —
// the web app's jwt-callback fallback creates the customer later if we miss.
const PRE_SIGN_UP_SHOPIFY_DEADLINE_MS = 3_500;

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
  {enrichIfExists = true}: {enrichIfExists?: boolean} = {},
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
      // A customer already exists (e.g. created for a guest checkout or by an
      // earlier sign-up path). Reuse it rather than duplicating; when this
      // registration's details are trustworthy, update the existing customer
      // with the latest consent and — when provided — name/phone (never wipe
      // existing values with blanks).
      logger.warn("[EmailExists] Email already exists in Shopify; reusing the existing customer.");
      const existingId = await findCustomerIdByEmail(email);
      if (existingId && enrichIfExists) {
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
 * Apply this registration's details to a Shopify customer that already exists.
 * Best-effort: this is enrichment, so a failure here must never break
 * sign-up/sign-in — the Cognito↔Shopify link is the part that matters.
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
 * Facebook accounts registered by phone). Keyed on the provider identity because
 * the Cognito sub doesn't exist yet at PreSignUp time. Exists so every user can
 * have a Shopify customer. The web app derives the same address when it resolves
 * the customer for an email-less session — keep the two in sync.
 */
function placeholderEmail(providerName: string, providerUserId: string): string {
  return `unknown-${providerName.toLowerCase()}-${providerUserId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/**
 * First social sign-in: make sure a Shopify customer exists for this person.
 *
 * The federated user itself doesn't exist yet at PreSignUp time, so the customer
 * id cannot be persisted to `custom:shopify_customer_id` here — the web app's
 * jwt-callback fallback finds the customer by email and attaches it per session.
 */
async function createShopifyCustomerForFederatedUser(e: PreSignUpEvent): Promise<void> {
  const logger = getLogger();

  const parsed = parseExternalUserName(e.userName);
  if (!parsed) {
    logger.warn({userName: e.userName}, "[PreSignUp] unexpected external username format");
    return;
  }
  const {providerName, providerUserId} = parsed;

  const attrs = e.request.userAttributes;
  const providerEmail = attrs.email;
  const email = providerEmail ?? placeholderEmail(providerName, providerUserId);

  // Only treat the address as belonging to this person when the provider itself
  // verified it (mapped from the IdP's email_verified claim — Google and Apple
  // send it; Facebook doesn't) and it isn't an Apple relay. An untrusted address
  // still keys the customer, but never modifies an existing customer's record.
  const emailTrusted =
    Boolean(providerEmail) &&
    attrs.email_verified === "true" &&
    !providerEmail!.toLowerCase().endsWith(APPLE_RELAY_SUFFIX);

  const shopifyCustomerId = await createShopifyCustomer(
    email,
    {
      firstName: attrs.given_name,
      lastName: attrs.family_name,
      name: attrs.name,
      // Social sign-ins carry no marketing consent — never opt anyone in here.
      acceptsMarketing: false,
    },
    {enrichIfExists: emailTrusted},
  );

  if (shopifyCustomerId) {
    logger.info(
      {provider: providerName, placeholder: !providerEmail},
      "[PreSignUp] shopify customer ready for federated user",
    );
  } else {
    logger.warn("[PreSignUp] could not create a Shopify customer for the federated user");
  }
}

/**
 * Tell the account owner their password was just set/changed, so a takeover
 * (e.g. via a leaked reset link) can't happen silently. Best-effort: a
 * notification failure must never fail the password reset it reports on.
 * Skipped when the account has no verified address to reach. (Synthetic
 * placeholder addresses never appear as Cognito email attributes on this
 * branch, so they can't be mailed from here.)
 */
async function notifyPasswordChanged(
  attrs: PostConfirmationEvent["request"]["userAttributes"],
): Promise<void> {
  const logger = getLogger();
  try {
    if (!SES_FROM_ADDRESS) {
      logger.warn("password-change notification skipped: SES_FROM_ADDRESS not configured");
      return;
    }
    if (!attrs.email || attrs.email_verified !== "true") {
      logger.info("password-change notification skipped: no reachable verified email");
      return;
    }

    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: SES_FROM_ADDRESS,
        ...(SES_CONFIGURATION_SET ? {ConfigurationSetName: SES_CONFIGURATION_SET} : {}),
        Destination: {ToAddresses: [attrs.email]},
        Content: {
          Simple: {
            Subject: {Data: "Your Forged & Found password was changed", Charset: "UTF-8"},
            Body: {Html: {Data: await renderPasswordChangedEmail(), Charset: "UTF-8"}},
          },
        },
      }),
    );
    logger.info("password-change notification sent");
  } catch (err) {
    logger.error({err}, "password-change notification failed (non-fatal)");
  }
}

export const handler = async (event: Event, context: Context): Promise<Event> => {
  return withLambdaLogger(context, async () => {
    return await authHandler(event);
  });
};

const authHandler = async (event: Event): Promise<Event> => {
  const logger = getLogger();

  // A first social sign-in. Best-effort and deadline-bounded: a thrown error or
  // timeout here would fail the trigger and block the user's sign-in, and the
  // web app can recover a missing customer later. Never touches the normal
  // PreSignUp_SignUp path — that must keep its email verification, so we return
  // the event untouched.
  if (event.triggerSource === "PreSignUp_ExternalProvider") {
    try {
      const deadline = new Promise<"timeout">((resolve) => {
        const t = setTimeout(() => resolve("timeout"), PRE_SIGN_UP_SHOPIFY_DEADLINE_MS);
        t.unref?.();
      });
      const result = await Promise.race([
        createShopifyCustomerForFederatedUser(event as PreSignUpEvent),
        deadline,
      ]);
      if (result === "timeout") {
        logger.warn("[PreSignUp] shopify work hit the trigger deadline — deferring to the app fallback");
      }
    } catch (err) {
      logger.error({err}, "[PreSignUp] shopify customer creation failed (non-fatal)");
    }
    return event;
  }

  const e = event as PostConfirmationEvent;

  // Fires after a successful forgot-password confirmation — the only place a
  // password gets set on this branch.
  if (e.triggerSource === "PostConfirmation_ConfirmForgotPassword") {
    await notifyPasswordChanged(e.request.userAttributes);
    return event;
  }

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
