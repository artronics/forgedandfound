import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    shopifyCustomerId?: string;
    userId?: string;
    provider?: string;
    providerUserId?: string;
    /** True when the email is synthetic/relay — treat the user as having none. */
    emailPlaceholder?: boolean;
  }

  interface User {
    shopifyCustomerId?: string;
    emailPlaceholder?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    shopifyCustomerId?: string;
    provider?: string;
    providerUserId?: string;
    emailPlaceholder?: boolean;
  }
}
