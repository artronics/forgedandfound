import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import {
  renderLinkAccountsEmail,
  renderPasswordChangedEmail,
  renderVerifyEmail,
} from "@forgedandfound/email/emails";
import {getLogger} from "@forgedandfound/logger";
import {getUserEmailProfile} from "./cognito";

const ses = new SESv2Client({});

const FROM_ADDRESS = process.env.SES_FROM_ADDRESS!;
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET;

async function sendHtmlEmail(to: string, subject: string, html: string): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: FROM_ADDRESS,
      ...(CONFIGURATION_SET ? {ConfigurationSetName: CONFIGURATION_SET} : {}),
      Destination: {ToAddresses: [to]},
      Content: {
        Simple: {
          Subject: {Data: subject, Charset: "UTF-8"},
          Body: {Html: {Data: html, Charset: "UTF-8"}},
        },
      },
    }),
  );
}

/** Verification link for adding/changing the account email. */
export async function sendEmailChangeVerification(
  to: string,
  verificationUrl: string,
): Promise<void> {
  await sendHtmlEmail(
    to,
    "Verify your Forged & Found email",
    await renderVerifyEmail({verificationUrl}),
  );
}

/**
 * Approval link sent to the OWNER of an existing account when someone asks to
 * link a social sign-in to it. Completing it requires signing in to that
 * account, so the email alone can't hand the account over.
 */
export async function sendLinkAccountsEmail(to: string, confirmUrl: string): Promise<void> {
  await sendHtmlEmail(
    to,
    "Confirm linking a new sign-in to your Forged & Found account",
    await renderLinkAccountsEmail({confirmUrl}),
  );
}

/**
 * Tell the account owner their password was just set/changed, so a takeover via
 * a stolen session can't happen silently. Best-effort: a notification failure
 * must never fail the operation it reports on. Skipped when the account has no
 * real, verified address to reach (placeholder / unverified).
 */
export async function notifyPasswordChanged(username: string): Promise<void> {
  const logger = getLogger();
  try {
    const {email, emailVerified, emailPlaceholder} = await getUserEmailProfile(username);
    if (!email || !emailVerified || emailPlaceholder) {
      logger.info("password-change notification skipped: no reachable verified email");
      return;
    }

    await sendHtmlEmail(
      email,
      "Your Forged & Found password was changed",
      await renderPasswordChangedEmail(),
    );
  } catch (err) {
    logger.error({err}, "password-change notification failed (non-fatal)");
  }
}
