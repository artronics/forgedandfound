import {render, Text} from "react-email";

import {EmailLayout} from "./components/EmailLayout";
import {Header} from "./components/Header";
import {Footer} from "./components/Footer";

export interface VerifyEmailChangeProps {
  code?: string;
}

/**
 * Sent to the *new* address when a signed-in user changes their account email.
 * Carries a code (not a link): the user is already authenticated on the account
 * page and enters the code there to confirm they own the new address, at which
 * point Cognito swaps the verified email over.
 */
export default function VerifyEmailChangeEmail(
  {
    code,
  }: VerifyEmailChangeProps) {
  return (
    <EmailLayout preview="Confirm your new email address">
      <Header/>
      <Text>
        Use this code to confirm this as the email address for your Forged &amp;
        Found account:
      </Text>

      <Text className="text-2xl font-bold tracking-widest text-primary">
        {code ?? "{####}"}
      </Text>

      <Text>
        Enter it on the account page where you started the change. If you didn&apos;t
        request this, you can ignore this email — your current email address stays
        unchanged.
      </Text>

      <Footer/>
    </EmailLayout>
  );
}

export const toHtml = async (props: VerifyEmailChangeProps) =>
  await render((<VerifyEmailChangeEmail {...props}/>));
