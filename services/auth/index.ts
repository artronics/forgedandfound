import {buildClient, CommitmentPolicy, KmsKeyringNode} from "@aws-crypto/client-node";
import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import {renderResetPasswordEmail, renderVerifyEmail} from "@forgedandfound/email/emails";

const {decrypt} = buildClient(
  CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT,
);

const ses = new SESv2Client({});

const FROM_ADDRESS = process.env.SES_FROM_ADDRESS!;
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET!;
const KMS_KEY_ID = process.env.KMS_KEY_ID!;
const ACCOUNT_URL = process.env.ACCOUNT_URL!;
const APP_URL = process.env.APP_URL!;

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

function buildAccountUrl(
  event: CustomEmailSenderEvent,
  code: string,
  pathname: string,
): string {
  const url = new URL(
    pathname,
    ACCOUNT_URL,
  );

  url.searchParams.set(
    "client_id",
    event.callerContext.clientId,
  );

  url.searchParams.set(
    "user_name",
    event.userName,
  );

  url.searchParams.set(
    "confirmation_code",
    code,
  );

  return url.toString();
}

function buildAppUrl(
  event: CustomEmailSenderEvent,
  code: string,
  pathname: string,
): string {
  const url = new URL(
    pathname,
    APP_URL,
  );
  url.searchParams.set(
    "email",
    event.userName,
  );

  url.searchParams.set(
    "code",
    code,
  );

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
}

export const handler = async (
    event: CustomEmailSenderEvent,
  ): Promise<CustomEmailSenderEvent> => {
    console.log(
      "triggerSource:",
      event.triggerSource,
    );

    const supportedTriggers = [
      "CustomEmailSender_SignUp",
      "CustomEmailSender_ResendCode",
      "CustomEmailSender_ForgotPassword",
    ];

    if (
      !supportedTriggers.includes(
        event.triggerSource,
      )
    ) {
      return event;
    }

    const code = await decryptCode(
      event.request.code,
    );

    const toAddress =
      event.request.userAttributes.email;

    switch (event.triggerSource) {
      case "CustomEmailSender_SignUp":
      case "CustomEmailSender_ResendCode": {
        const verificationUrl = buildAccountUrl(
          event,
          code,
          "/confirmUser",
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
          event,
          code,
          "/account/login/reset",
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
    }

    return event;
  }
;
