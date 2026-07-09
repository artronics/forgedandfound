// TODO: When user uses both email/pass (cognito idp) and social ones there is no consolidation logic.
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import {createCustomer, findCustomerByEmail} from "@forgedandfound/lib/shopify/customer";

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
      console.warn("[EmailExists] Email already exists in Shopify, getting current email.");
      // TODO: When user exists we may have more info in here (like phone number). This should update the existing customer.
      return findCustomerIdByEmail(email);
    }
    throw new Error(`Shopify customerCreate errors: ${JSON.stringify(userErrors)}`);
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

export const handler = async (event: Event): Promise<Event> => {
  let userPoolId: string;
  let userName: string;
  let email: string;
  let firstName: string | undefined;
  let lastName: string | undefined;
  let name: string | undefined;
  let phone: string | undefined;

  const e = event as PostConfirmationEvent;
  if (e.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    console.log("Skipping trigger:", e.triggerSource);
    return event;
  }
  userPoolId = e.userPoolId;
  userName = e.userName;
  email = e.request.userAttributes.email;
  firstName = e.request.userAttributes.given_name;
  lastName = e.request.userAttributes.family_name;
  name = e.request.userAttributes.name;
  phone = e.request.userAttributes.phone_number;

  console.log("Creating Shopify customer for:", email);
  const shopifyCustomerId = await createShopifyCustomer(email, {firstName, lastName, name, phone});
  if (shopifyCustomerId === null) {
    console.warn("[ShopifyCustomerCreationFailed] Failed to create Shopify customer, skipping.");
    return event;
  }
  console.log("Shopify customer created:", shopifyCustomerId);

  await saveShopifyIdToCognito(userPoolId, userName, shopifyCustomerId);
  console.log("Shopify ID saved to Cognito as custom:shopify_customer_id");

  return event;
};
