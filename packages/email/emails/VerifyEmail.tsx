import {Button, Link, render, Text} from "react-email";

import {EmailLayout} from "./components/EmailLayout";
import {Header} from "./components/Header";
import {Footer} from "./components/Footer";

export interface VerifyEmailProps {
  verificationUrl?: string;
}

export default function VerifyEmail(
  {
    verificationUrl,
  }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Verify your account">
      <Header/>
      <Text>
        Please verify your email address.
      </Text>

      <Button className="bg-primary">
        <Link href={verificationUrl ?? "{##Verify Email##}"}>Verify Email</Link>
      </Button>

      <Text>
        Or copy and paste the following link into your browser:
        <br/>
        <Link href={verificationUrl ?? "{##Verify Email##}"}>{verificationUrl ?? "{##Verify Email##}"}</Link>
      </Text>

      <Footer/>
    </EmailLayout>
  );
}

export const toHtml = async (props: VerifyEmailProps) => await render((<VerifyEmail {...props}/>));

