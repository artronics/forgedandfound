import {
  Button, Link,
  Text,
} from "react-email";
import {render} from "react-email";

import {EmailLayout} from "./components/EmailLayout";
import {Header} from "./components/Header";
import {Footer} from "./components/Footer";

export interface ResetPasswordEmailProps {
  verificationUrl?: string;
}

export default function ResetPasswordEmail(
  {
    verificationUrl,
  }: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Verify your account">
      <Header/>
      <Text>
        Please follow the link below to reset your password
      </Text>

      <Button className="bg-primary">
        <Link href={verificationUrl ?? "{##Verify Email##}"}>Reset Password</Link>
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

export const toHtml = async (props: ResetPasswordEmailProps) => await render((<ResetPasswordEmail {...props}/>));
