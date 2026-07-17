import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import {renderPasswordChangedEmail} from "@forgedandfound/email/emails";
import {getLogger} from "@forgedandfound/logger";
import {getUserEmailProfile} from "./cognito";

const ses = new SESv2Client({});

const FROM_ADDRESS = process.env.SES_FROM_ADDRESS!;
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET;

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

    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: FROM_ADDRESS,
        ...(CONFIGURATION_SET ? {ConfigurationSetName: CONFIGURATION_SET} : {}),
        Destination: {ToAddresses: [email]},
        Content: {
          Simple: {
            Subject: {Data: "Your Forged & Found password was changed", Charset: "UTF-8"},
            Body: {Html: {Data: await renderPasswordChangedEmail(), Charset: "UTF-8"}},
          },
        },
      }),
    );
  } catch (err) {
    logger.error({err}, "password-change notification failed (non-fatal)");
  }
}
