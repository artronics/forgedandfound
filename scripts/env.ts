import dotenv from "dotenv";

dotenv.config();

const shopifyStoreName = process.env.SHOPIFY_STORE_NAME!;

const aws_profile = process.env.AWS_PROFILE!;
if (!aws_profile.includes("nonprod")) {
  throw new Error("aws commands are only accepted for nonprod");
}

export const shopify = {
  storeName: shopifyStoreName,
  shopDomain: `${shopifyStoreName}.myshopify.com`,
  tokenUrl: `https://${shopifyStoreName}.myshopify.com/admin/oauth/access_token`,
  appClientId: process.env.SHOPIFY_CLIENT_ID!,
  appClientSecret: process.env.SHOPIFY_CLIENT_SECRET!,
} as const;

export const aws = {
  profile: aws_profile,
  cognito: {
    userPoolId: process.env.COGNITO_USER_POOL_ID!,
  },
} as const;