import crypto from "node:crypto";
import {
  AdminDeleteUserCommand,
  AdminDisableProviderForUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
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

export interface UserEmailProfile {
  email?: string;
  emailVerified: boolean;
  emailPlaceholder: boolean;
}

/**
 * The user's email state as Cognito holds it, for deciding whether a security
 * notification can actually reach them (placeholder/unverified addresses can't).
 */
export async function getUserEmailProfile(username: string): Promise<UserEmailProfile> {
  const res = await cognito.send(
    new AdminGetUserCommand({UserPoolId: USER_POOL_ID, Username: username}),
  );
  const attrs = new Map(res.UserAttributes?.map((a) => [a.Name, a.Value]));
  return {
    email: attrs.get("email"),
    emailVerified: attrs.get("email_verified") === "true",
    emailPlaceholder: attrs.get("custom:email_placeholder") === "true",
  };
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
 * Apply a new, verified email to the user in one atomic admin write. Only ever
 * called after the address has been proven via our signed-token link (see
 * tokens.ts) — never with an unproven value. Replaces Cognito's self-service
 * UpdateUserAttributes flow, which swapped the address immediately while
 * leaving it unverified.
 */
export async function setVerifiedEmail(username: string, email: string): Promise<void> {
  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: [
        {Name: "email", Value: email},
        {Name: "email_verified", Value: "true"},
      ],
    }),
  );
}

export interface PoolUser {
  username: string;
  status?: string;
  emailVerified: boolean;
  shopifyCustomerId?: string;
  identities: { providerName: string; userId: string }[];
}

function parseIdentities(raw?: string): { providerName: string; userId: string }[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as { providerName?: string; userId?: string }[];
    return list.filter(
      (i): i is { providerName: string; userId: string } =>
        typeof i.providerName === "string" && typeof i.userId === "string",
    );
  } catch {
    return [];
  }
}

/** Full profile by username (in this pool the username equals the sub). */
export async function getPoolUser(username: string): Promise<PoolUser> {
  const res = await cognito.send(
    new AdminGetUserCommand({UserPoolId: USER_POOL_ID, Username: username}),
  );
  const attrs = new Map(res.UserAttributes?.map((a) => [a.Name, a.Value]));
  return {
    username: res.Username!,
    status: res.UserStatus,
    emailVerified: attrs.get("email_verified") === "true",
    shopifyCustomerId: attrs.get("custom:shopify_customer_id"),
    identities: parseIdentities(attrs.get("identities")),
  };
}

/** The user currently holding this email, if any. */
export async function findUserByEmail(email: string): Promise<PoolUser | null> {
  // The filter value is a quoted string — strip anything that could break out.
  const safeEmail = email.replace(/["\\]/g, "");
  const {Users} = await cognito.send(
    new ListUsersCommand({UserPoolId: USER_POOL_ID, Filter: `email = "${safeEmail}"`}),
  );
  const user = Users?.[0];
  if (!user?.Username) return null;
  const attrs = new Map(user.Attributes?.map((a) => [a.Name, a.Value]));
  return {
    username: user.Username,
    status: user.UserStatus,
    emailVerified: attrs.get("email_verified") === "true",
    shopifyCustomerId: attrs.get("custom:shopify_customer_id"),
    identities: parseIdentities(attrs.get("identities")),
  };
}

/** Detach a federated identity from whichever user it's linked to. */
export async function unlinkProvider(
  provider: string,
  providerUserId: string,
): Promise<void> {
  await cognito.send(
    new AdminDisableProviderForUserCommand({
      UserPoolId: USER_POOL_ID,
      User: {
        ProviderName: provider,
        ProviderAttributeName: "Cognito_Subject",
        ProviderAttributeValue: providerUserId,
      },
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
