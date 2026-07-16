// TODO: When user uses both email/pass (cognito idp) and social ones there is no consolidation logic.
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import {createCustomer, findCustomerByEmail} from "@forgedandfound/shopify-admin-client/customer";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {Context} from "aws-lambda";
import {getLogger} from "@forgedandfound/logger";

const cognito = new CognitoIdentityProviderClient({});

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

type Event = PostConfirmationEvent;

async function createShopifyCustomer(
  email: string,
  attributes: {
    firstName?: string,
    lastName?: string,
    name?: string,
    phone?: string,
  },
): Promise<string | null> {
  const logger = getLogger();
  const {firstName, lastName, name, phone} = attributes;
  const input = {
    email,
    firstName: firstName ?? name ?? "",
    lastName: lastName ?? "",
    phone: phone ?? "",
    emailMarketingConsent: {
      marketingState: "NOT_SUBSCRIBED",
    },
  };
  const {customer, userErrors} = (await createCustomer(input)).customerCreate;

  if (userErrors.length) {
    if (userErrors.some(e => e.message.toLowerCase().includes("email has already been taken"))) {
      logger.warn("[EmailExists] Email already exists in Shopify, getting current email.");
      // TODO: When user exists we may have more info in here (like phone number). This should update the existing customer.
      return findCustomerIdByEmail(email);
    }
    const e = new Error(`Shopify customerCreate errors: ${JSON.stringify(userErrors)}`);
    logger.error(e);
    throw e;
  }

  return customer!.id;
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

export const handler = async (event: Event, context: Context): Promise<Event> => {
  return withLambdaLogger(context, async () => {
    return await authHandler(event);
  });
};

const authHandler = async (event: Event): Promise<Event> => {
  const logger = getLogger();
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

  if (!email) {
    logger.warn("[MissingEmail] No email on user attributes, skipping Shopify customer creation.");
    logger.debug(e, "skipping Shopify customer creation");
    return event;
  }

  const shopifyCustomerId = await createShopifyCustomer(email, {firstName, lastName, name, phone});
  if (shopifyCustomerId === null) {
    logger.warn("[ShopifyCustomerCreationFailed] Failed to create Shopify customer, skipping.");
    return event;
  }

  await saveShopifyIdToCognito(userPoolId, userName, shopifyCustomerId);
  logger.info("shopify customer ID has been synced successfully");

  return event;
};

