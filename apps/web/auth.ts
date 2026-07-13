import NextAuth, {CredentialsSignin} from "next-auth";
import Cognito from "next-auth/providers/cognito";
import Credentials from "next-auth/providers/credentials";
import {getOrCreateCustomer} from "@/lib/shopify/admin/customer";
import {decodeIdToken, signInWithPassword} from "@/lib/auth/cognito";
import {oidc_config} from "@/lib/env";

class EmailNotVerifiedError extends CredentialsSignin {
  code = "EmailNotVerified";
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  debug: true,
  providers: [
    Cognito({
      clientId: oidc_config.cognito_client_id,
      clientSecret: oidc_config.cognito_client_secret,
      issuer: oidc_config.cognito_issuer_url,
      // IMPORTANT: Do not delete this line otherwise, you'll get "nonce" error when login with Google
      checks: ["nonce", "pkce", "state"],
    }),

    Credentials({
      credentials: {
        email: {label: "Email", type: "email"},
        password: {label: "Password", type: "password"},
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        try {
          const tokens = await signInWithPassword(email, password);
          if (!tokens?.IdToken) return null;

          const claims = decodeIdToken(tokens.IdToken);
          const name = [claims.given_name, claims.family_name]
            .filter(Boolean)
            .join(" ")
            .trim();

          return {
            id: claims.sub ?? email,
            email: claims.email ?? email,
            name: name || null,
            shopifyCustomerId: claims["custom:shopify_customer_id"],
          };
        } catch (err) {
          const name = (err as { name?: string }).name;
          if (name === "UserNotConfirmedException") {
            throw new EmailNotVerifiedError();
          }
          // NotAuthorizedException / UserNotFoundException / anything else →
          // generic invalid-credentials failure.
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({token, user, profile}) {
      const customerId =
        (profile as Record<string, unknown> | undefined)?.[
          "custom:shopify_customer_id"
          ] ?? user?.shopifyCustomerId;

      if (customerId && customerId !== "undefined") {
        token.shopifyCustomerId = String(customerId);
        return token;
      }

      // TODO: this path is not tested. It should not happen since shopify user should be created in lambda
      if (user?.email) {
        console.warn("[ShopifyCustomerIdDoesNotExist] Creating customer for user");
        token.shopifyCustomerId = await getOrCreateCustomer(user.email);
      }

      return token;
    },

    async session({session, token}) {
      session.shopifyCustomerId = token.shopifyCustomerId as string;
      return session;
    },
  },
});
