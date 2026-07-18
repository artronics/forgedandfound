import "server-only";
import crypto from "node:crypto";
import {
  type AuthenticationResultType,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
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
 * Exchange a refresh token for a fresh access + ID token. `username` must be
 * the user's actual Cognito Username for the SECRET_HASH — the generated UUID
 * (== sub) for SignUp-created users, `<Provider>_<id>` for federated users —
 * so callers should pass the `cognito:username` claim captured at sign-in.
 */
export async function refreshTokens(
  username: string,
  refreshToken: string,
): Promise<AuthenticationResultType | undefined> {
  const result = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: oidc_config.cognito_client_id,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: secretHash(username),
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
  {firstName, lastName, acceptsMarketing}: {
    firstName?: string;
    lastName?: string;
    acceptsMarketing?: boolean;
  } = {},
  clientMetadata?: Record<string, string>,
): Promise<{ userConfirmed: boolean }> {
  const userAttributes: { Name: string; Value: string }[] = [
    {Name: "email", Value: email},
    // Persisted so the Post-Confirmation Lambda can set the matching Shopify
    // email-marketing consent when it creates the customer.
    {Name: "custom:accepts_marketing", Value: acceptsMarketing ? "true" : "false"},
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
      ClientMetadata: clientMetadata,
    }),
  );

  return {userConfirmed: Boolean(result.UserConfirmed)};
}

/**
 * Confirm a sign-up with the code from the verification link, marking the user's
 * email as verified. Requires the SECRET_HASH (the app client has a secret), so
 * this must run server-side. Throws the underlying Cognito error so callers can
 * map it (e.g. CodeMismatchException, ExpiredCodeException, or
 * NotAuthorizedException when the user is already confirmed).
 */
export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognitoClient.send(
    new ConfirmSignUpCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
      ConfirmationCode: code,
    }),
  );
}

/**
 * Resend the sign-up confirmation link/code. Cognito re-sends via the user
 * pool's Custom Message Lambda. Throws the underlying Cognito error so callers
 * can map it (e.g. InvalidParameterException when already confirmed).
 */
export async function resendConfirmationCode(
  email: string,
  clientMetadata?: Record<string, string>,
): Promise<void> {
  await cognitoClient.send(
    new ResendConfirmationCodeCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
      ClientMetadata: clientMetadata,
    }),
  );
}

/**
 * Trigger a password reset. Cognito emails the confirmation code (via the user
 * pool's Custom Message Lambda, which builds the /account/login/reset link).
 * Throws the underlying Cognito error so callers can map it.
 */
export async function forgotPassword(
  email: string,
  clientMetadata?: Record<string, string>,
): Promise<void> {
  await cognitoClient.send(
    new ForgotPasswordCommand({
      ClientId: oidc_config.cognito_client_id,
      SecretHash: secretHash(email),
      Username: email,
      ClientMetadata: clientMetadata,
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

/**
 * Build the ClientMetadata map Cognito forwards to the Custom Email Sender
 * Lambda, carrying the storefront the request came from so the Lambda can point
 * the verification/reset link back at the right origin (and page). Only defined
 * values are included — Cognito requires all ClientMetadata values to be strings.
 */
export function buildAppMetadata(
  origin?: string,
  returnTo?: string,
): Record<string, string> | undefined {
  const metadata: Record<string, string> = {};
  if (origin) metadata.origin = origin;
  if (returnTo) metadata.returnTo = returnTo;
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export type CognitoIdTokenClaims = {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  "cognito:username"?: string;
  "custom:shopify_customer_id"?: string;
  "custom:email_placeholder"?: string;
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
