import dotenv from "dotenv";

// Quiet: commands print machine-readable output (e.g. a token) to stdout, so
// dotenv's tip banner must not leak onto it.
dotenv.config({quiet: true});

const shopifyStoreName = process.env.NEXT_PUBLIC_SHOPIFY_STORE_NAME!;

export const shopify = {
  storeName: shopifyStoreName,
  shopDomain: `${shopifyStoreName}.myshopify.com`,
} as const;

// A function, not a module-level check, so non-AWS commands (e.g.
// `ff shopify get-admin-token`) don't require an AWS profile just to import this.
export function awsEnv() {
  const profile = process.env.AWS_PROFILE;
  if (!profile?.includes("nonprod")) {
    throw new Error("aws commands are only accepted for nonprod");
  }
  return {
    profile,
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
    },
  } as const;
}
