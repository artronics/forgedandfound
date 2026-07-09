import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    shopifyCustomerId?: string;
  }

  interface User {
    shopifyCustomerId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    shopifyCustomerId?: string;
  }
}