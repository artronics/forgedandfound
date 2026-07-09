import "server-only";
import crypto from "node:crypto";
import {
  type AuthenticationResultType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {oidc_config} from "@/lib/env";

const REGION = "eu-west-2";

export const cognitoClient = new CognitoIdentityProviderClient({region: REGION});

/**
 * HMAC-SHA256 of `username + clientId`, keyed by the app client secret. Required
 * on every unauthenticated Cognito call because the app client has a secret.
 */
export function secretHash(username: string): string {
  return crypto
    .createHmac("sha256", oidc_config.cognito_client_secret)
    .update(username + oidc_config.cognito_client_id)
    .digest("base64");
}

/**
 * Authenticate a user with email + password via the USER_PASSWORD_AUTH flow.
 * Returns the raw AuthenticationResult (access/id/refresh tokens) on success.
 * Throws the underlying Cognito error (e.g. NotAuthorizedException,
 * UserNotConfirmedException) so callers can map it.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthenticationResultType | undefined> {
  const result = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: oidc_config.cognito_client_id,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash(email),
      },
    }),
  );

  return result.AuthenticationResult;
}

/**
 * Register a new user. Cognito emails the verification link/code based on the
 * user pool configuration. Returns whether the user is auto-confirmed.
 */
export async function signUp(
  email: string,
  password: string,
  {firstName, lastName}: { firstName?: string; lastName?: string } = {},
): Promise<{ userConfirmed: boolean }> {
  const userAttributes: { Name: string; Value: string }[] = [
    {Name: "email", Value: email},
  ];
  if (firstName) userAttributes.push({Name: "given_name", Value: firstName});
  if (lastName) userAttributes.push({Name: "family_name", Value: lastName});

  const result = await cognitoClient.send(
    new SignUpCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    }),
  );

  return {userConfirmed: Boolean(result.UserConfirmed)};
}

/**
 * Resend the sign-up confirmation link/code. Cognito re-sends via the user
 * pool's Custom Message Lambda. Throws the underlying Cognito error so callers
 * can map it (e.g. InvalidParameterException when already confirmed).
 */
export async function resendConfirmationCode(email: string): Promise<void> {
  await cognitoClient.send(
    new ResendConfirmationCodeCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
    }),
  );
}

/**
 * Trigger a password reset. Cognito emails the confirmation code (via the user
 * pool's Custom Message Lambda, which builds the /account/login/reset link).
 * Throws the underlying Cognito error so callers can map it.
 */
export async function forgotPassword(email: string): Promise<void> {
  await cognitoClient.send(
    new ForgotPasswordCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
    }),
  );
}

/**
 * Complete a password reset with the confirmation code from the reset link and
 * the user's chosen new password. Throws the underlying Cognito error
 * (e.g. CodeMismatchException, ExpiredCodeException, InvalidPasswordException).
 */
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  await cognitoClient.send(
    new ConfirmForgotPasswordCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    }),
  );
}

export type CognitoIdTokenClaims = {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  "custom:shopify_customer_id"?: string;
};

/**
 * Decode (without verifying) the payload of a Cognito ID token. The token comes
 * straight from a trusted Cognito API response over TLS, so signature
 * verification is unnecessary here.
 */
export function decodeIdToken(idToken: string): CognitoIdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) return {};
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}
