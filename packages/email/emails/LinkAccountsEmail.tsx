import {Button, Link, render, Text} from "react-email";

import {EmailLayout} from "./components/EmailLayout";
import {Header} from "./components/Header";
import {Footer} from "./components/Footer";

export interface LinkAccountsEmailProps {
  confirmUrl?: string;
}

/**
 * Sent to the owner of an existing account when someone (hopefully them) asks
 * to link a new social sign-in to it. Approving requires signing in to the
 * existing account, so a stray click alone can never hand the account over.
 */
export default function LinkAccountsEmail(
  {
    confirmUrl,
  }: LinkAccountsEmailProps) {
  return (
    <EmailLayout preview="Confirm linking a new sign-in to your account">
      <Text>
        A request was made to link a new sign-in method (such as Google, Facebook
        or Apple) to your Forged &amp; Found account.
      </Text>

      <Text>
        If this was you, confirm below — you&apos;ll be asked to sign in to your
        existing account first. If this wasn&apos;t you, ignore this email and
        nothing will change.
      </Text>

      <Button className="bg-primary">
        <Link href={confirmUrl ?? "{##Confirm Link##}"}>Confirm link</Link>
      </Button>

      <Text>
        Or copy and paste the following link into your browser:
        <br/>
        <Link href={confirmUrl ?? "{##Confirm Link##}"}>{confirmUrl ?? "{##Confirm Link##}"}</Link>
      </Text>

      <Footer/>
    </EmailLayout>
  );
}

export const toHtml = async (props: LinkAccountsEmailProps) => await render((<LinkAccountsEmail {...props}/>));
