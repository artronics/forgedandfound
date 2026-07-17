import crypto from "node:crypto";
import {
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  GetUserAttributeVerificationCodeCommand,
  GetUserCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand,
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

/**
 * Set a permanent password for the signed-in user. Used instead of the
 * email-reset flow: it works even for users with a linked social identity (whose
 * email can't be verified, so ForgotPassword is unavailable to them). The caller
 * is already authenticated via their session, which is the proof of ownership.
 */
export async function setPassword(username: string, password: string): Promise<void> {
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );
}

/**
 * Set a new email on the signed-in user using their own access token. Because
 * email is an auto-verified attribute, Cognito emails a verification code to the
 * NEW address and leaves email_verified false until it's confirmed — so nothing
 * is applied to an address the user hasn't proven they own.
 */
export async function requestEmailChange(
  accessToken: string,
  email: string,
  clientMetadata?: Record<string, string>,
): Promise<void> {
  await cognito.send(
    new UpdateUserAttributesCommand({
      AccessToken: accessToken,
      UserAttributes: [{Name: "email", Value: email}],
      ClientMetadata: clientMetadata,
    }),
  );
}

/** Re-send the verification code for a pending email change. */
export async function resendEmailVerificationCode(
  accessToken: string,
  clientMetadata?: Record<string, string>,
): Promise<void> {
  await cognito.send(
    new GetUserAttributeVerificationCodeCommand({
      AccessToken: accessToken,
      AttributeName: "email",
      ClientMetadata: clientMetadata,
    }),
  );
}

/**
 * Read the user's email as Cognito currently holds it. Used after a
 * verification so downstream sync uses the address that was actually verified,
 * never a client-supplied value.
 */
export async function getEmail(accessToken: string): Promise<string | undefined> {
  const res = await cognito.send(new GetUserCommand({AccessToken: accessToken}));
  return res.UserAttributes?.find((a) => a.Name === "email")?.Value;
}

/** Confirm the emailed code, marking the new email verified. */
export async function confirmEmailChange(accessToken: string, code: string): Promise<void> {
  await cognito.send(
    new VerifyUserAttributeCommand({
      AccessToken: accessToken,
      AttributeName: "email",
      Code: code,
    }),
  );
}

/** Clear the placeholder marker once the user has a real, verified address. */
export async function clearEmailPlaceholder(username: string): Promise<void> {
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [{Name: "custom:email_placeholder", Value: "false"}],
    }),
  );
}

/** Permanently delete a user. Irreversible. */
export async function deleteUser(username: string): Promise<void> {
  await cognito.send(
    new AdminDeleteUserCommand({UserPoolId: USER_POOL_ID, Username: username}),
  );
}
