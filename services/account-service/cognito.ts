import crypto from "node:crypto";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ListUsersCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION = process.env.AWS_REGION ?? "eu-west-2";
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET!;
const USER_POOL_ID = process.env.USER_POOL_ID!;

export const cognito = new CognitoIdentityProviderClient({region: REGION});

/** HMAC-SHA256 of `username + clientId`, keyed by the app client secret. */
function secretHash(username: string): string {
  return crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest("base64");
}

/**
 * Register a native email/password account. Cognito emails the verification
 * link (via the Custom Email Sender). `shopifyCustomerId`, when supplied, is
 * stored so the confirmed account inherits the social user's Shopify customer.
 */
export async function signUp(
  email: string,
  password: string,
  shopifyCustomerId?: string,
  clientMetadata?: Record<string, string>,
): Promise<void> {
  const userAttributes: { Name: string; Value: string }[] = [
    {Name: "email", Value: email},
  ];
  if (shopifyCustomerId) {
    userAttributes.push({Name: "custom:shopify_customer_id", Value: shopifyCustomerId});
  }

  await cognito.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash(email),
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
      ClientMetadata: clientMetadata,
    }),
  );
}

/** Confirm the emailed code, marking the native account's email verified. */
export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognito.send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash(email),
      Username: email,
      ConfirmationCode: code,
    }),
  );
}

/**
 * Resolve the real (UUID) username for an email. The pool uses email as a
 * sign-in alias, so the actual `Username` differs from the email and is what the
 * admin APIs need.
 */
export async function getUsername(email: string): Promise<string> {
  const res = await cognito.send(
    new AdminGetUserCommand({UserPoolId: USER_POOL_ID, Username: email}),
  );
  return res.Username!;
}

/**
 * Link a federated identity (e.g. Facebook/Apple) into the native user so both
 * sign-in paths resolve to one Cognito account.
 */
export async function linkProvider(
  nativeUsername: string,
  provider: string,
  providerUserId: string,
): Promise<void> {
  await cognito.send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: USER_POOL_ID,
      DestinationUser: {ProviderName: "Cognito", ProviderAttributeValue: nativeUsername},
      SourceUser: {
        ProviderName: provider,
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: providerUserId,
      },
    }),
  );
}

/** Persist the Shopify customer id onto the native user. */
export async function setShopifyCustomerId(
  nativeUsername: string,
  shopifyCustomerId: string,
): Promise<void> {
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: nativeUsername,
      UserAttributes: [{Name: "custom:shopify_customer_id", Value: shopifyCustomerId}],
    }),
  );
}

/**
 * Resolve a user's real `Username` from their `sub`. Works for federated users
 * too (whose username is provider-prefixed, not the email), so it's the reliable
 * way to target the caller for admin operations.
 */
export async function getUsernameBySub(sub: string): Promise<string | undefined> {
  const res = await cognito.send(
    new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `sub = "${sub}"`,
      Limit: 1,
    }),
  );
  return res.Users?.[0]?.Username;
}

/**
 * Set the user's display name. The profile UI collects a single `name`, which we
 * store in `given_name` (our canonical name field) and clear `family_name` so the
 * two can't drift or end up concatenated downstream.
 */
export async function updateName(username: string, name: string): Promise<void> {
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        {Name: "given_name", Value: name},
        {Name: "family_name", Value: ""},
      ],
    }),
  );
}

/** Start a self-service password reset (Cognito emails a reset link). */
export async function forgotPassword(email: string): Promise<void> {
  await cognito.send(
    new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      SecretHash: secretHash(email),
      Username: email,
    }),
  );
}

/** Permanently delete a user. Irreversible. */
export async function deleteUser(username: string): Promise<void> {
  await cognito.send(
    new AdminDeleteUserCommand({UserPoolId: USER_POOL_ID, Username: username}),
  );
}
