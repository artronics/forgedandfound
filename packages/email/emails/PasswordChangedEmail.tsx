import {render, Text} from "react-email";

import {EmailLayout} from "./components/EmailLayout";
import {Header} from "./components/Header";
import {Footer} from "./components/Footer";

/**
 * Security notification sent whenever a password is set or changed on an
 * account. Deliberately contains no link — a notification the user should never
 * need to click is harder to phish against.
 */
export default function PasswordChangedEmail() {
  return (
    <EmailLayout preview="Your password was changed">
      <Header/>
      <Text>
        The password for your Forged &amp; Found account was just changed.
      </Text>

      <Text>
        If this was you, no further action is needed. If you did not change your
        password, someone else may have access to your account — reset your
        password immediately from the sign-in page and contact us.
      </Text>

      <Footer/>
    </EmailLayout>
  );
}

export const toHtml = async () => await render((<PasswordChangedEmail/>));
