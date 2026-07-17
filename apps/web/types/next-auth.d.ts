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
    cognitoAccessToken?: string;
    cognitoRefreshToken?: string;
    cognitoExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    shopifyCustomerId?: string;
    provider?: string;
    providerUserId?: string;
    emailPlaceholder?: boolean;
    /**
     * Cognito tokens live on the JWT only — never mirrored into the Session,
     * which is readable by the browser.
     */
    cognitoAccessToken?: string;
    cognitoRefreshToken?: string;
    cognitoExpiresAt?: number;
  }
}
