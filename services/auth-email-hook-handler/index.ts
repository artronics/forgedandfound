import {buildClient, CommitmentPolicy, KmsKeyringNode} from "@aws-crypto/client-node";
import {withLambdaLogger} from "@forgedandfound/logger/lambda";
import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import {renderResetPasswordEmail, renderVerifyEmail} from "@forgedandfound/email/emails";
import {Context} from "aws-lambda";
import {getLogger} from "@forgedandfound/logger";

const {decrypt} = buildClient(
  CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT,
);

const ses = new SESv2Client({});

const FROM_ADDRESS = process.env.SES_FROM_ADDRESS!;
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET!;
const KMS_KEY_ID = process.env.KMS_KEY_ID!;
const APP_URL = process.env.APP_URL!;
// Storefront origins we're willing to send links to. One Cognito pool + one
// Lambda serve multiple nonprod storefronts, so the initiating app tells us its
// origin via ClientMetadata; we only honour it if it's on this list, otherwise
// we fall back to APP_URL. Prevents a crafted origin from making our email link
// to an attacker-controlled domain.
const ALLOWED_APP_ORIGINS = (process.env.ALLOWED_APP_ORIGINS ?? "")
  .split(",")
  .map((origin) => normaliseOrigin(origin))
  .filter(Boolean);

function normaliseOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

type TriggerSource =
  | "CustomEmailSender_SignUp"
  | "CustomEmailSender_ResendCode"
  | "CustomEmailSender_ForgotPassword"
  | "CustomEmailSender_UpdateUserAttribute"
  | "CustomEmailSender_VerifyUserAttribute"
  | "CustomEmailSender_AdminCreateUser"
  | "CustomEmailSender_AccountTakeOverNotification";

interface CustomEmailSenderEvent {
  version: string;
  triggerSource: TriggerSource;
  region: string;
  userPoolId: string;
  userName: string;
  callerContext: {
    awsSdkVersion: string;
    clientId: string;
  };
  request: {
    type: "customEmailSenderRequestV1";
    code: string;
    userAttributes: {
      sub: string;
      email_verified: string;
      email: string;
      [key: string]: string;
    };
    clientMetadata?: Record<string, string>;
  };
  response: Record<string, never>;
}

async function decryptCode(
  encryptedCode: string,
): Promise<string> {
  const keyring = new KmsKeyringNode({
    keyIds: [KMS_KEY_ID],
  });

  const {plaintext} = await decrypt(
    keyring,
    Buffer.from(encryptedCode, "base64"),
  );

  return plaintext.toString();
}

/**
 * The storefront origin to build links against. The initiating app sends its own
 * origin via ClientMetadata (so the right nonprod deployment is used); we honour
 * it only when it's on the allowlist, otherwise fall back to APP_URL.
 */
function resolveAppOrigin(event: CustomEmailSenderEvent): string {
  const requested = event.request.clientMetadata?.origin;
  if (!requested) return APP_URL;

  const normalised = normaliseOrigin(requested);
  if (ALLOWED_APP_ORIGINS.includes(normalised)) {
    return normalised;
  }

  getLogger().warn(
    {requested},
    "clientMetadata.origin not in allowlist; falling back to APP_URL",
  );
  return APP_URL;
}

function buildAppUrl(
  origin: string,
  pathname: string,
  params: Record<string, string>,
): string {
  const url = new URL(pathname, origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function sendEmail(
  toAddress: string,
  subject: string,
  html: string,
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: FROM_ADDRESS,
      ConfigurationSetName: CONFIGURATION_SET,
      Destination: {
        ToAddresses: [toAddress],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: html,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
  );
  getLogger().debug("email sent");
}

export const handler = async (event: CustomEmailSenderEvent, context: Context): Promise<CustomEmailSenderEvent> => {
  return withLambdaLogger(context, async () => {
    return await shopifyHandler(event);
  });
};

export const shopifyHandler = async (
    event: CustomEmailSenderEvent,
  ): Promise<CustomEmailSenderEvent> => {
    const logger = getLogger();

    const supportedTriggers = [
      "CustomEmailSender_SignUp",
      "CustomEmailSender_ResendCode",
      "CustomEmailSender_ForgotPassword",
    ];

    if (!supportedTriggers.includes(event.triggerSource)) {
      logger.info({triggerSource: event.triggerSource}, "unsupported event: skipping");
      return event;
    }

    const code = await decryptCode(
      event.request.code,
    );

    const toAddress =
      event.request.userAttributes.email;

    const appOrigin = resolveAppOrigin(event);
    const returnTo = event.request.clientMetadata?.returnTo;

    // The decrypted code must never be logged — a reset code in CloudWatch is
    // an account takeover for anyone with log access.
    logger.debug(
      {
        triggerSource: event.triggerSource,
        email: toAddress,
        appOrigin,
      }, "creating email trigger");

    switch (event.triggerSource) {
      case "CustomEmailSender_SignUp":
      case "CustomEmailSender_ResendCode": {
        const verificationUrl = buildAppUrl(
          appOrigin,
          "/account/verify",
          {
            email: event.request.userAttributes.email,
            code,
            ...(returnTo ? {next: returnTo} : {}),
          },
        );

        await sendEmail(
          toAddress,
          "Verify your Forged & Found account",
          await renderVerifyEmail({
            verificationUrl,
          }),
        );

        break;
      }
      case "CustomEmailSender_ForgotPassword": {
        const verificationUrl = buildAppUrl(
          appOrigin,
          "/account/login/reset",
          {
            email: event.request.userAttributes.email,
            code,
          },
        );
        await sendEmail(
          toAddress,
          "Reset your Forged & Found password",
          await renderResetPasswordEmail({
            verificationUrl: verificationUrl,
          }),
        );

        break;
      }
      default: {
        logger.error(
          {triggerSource: event.triggerSource}, "event wasn't filtered but wasn't handled either. This is a bug!");
      }
    }

    return event;
  }
;
