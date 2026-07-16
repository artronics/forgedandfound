export const isProd = (process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV) === "production";

export const oidc_config = {
  cognito_client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
  cognito_client_secret: process.env.COGNITO_CLIENT_SECRET!,
  redirect_uri: process.env.NEXT_PUBLIC_APP_URL + "/account/callback",
  cognito_issuer_url: process.env.COGNITO_ISSUER_URL,
};

const shopifyUrl = `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_NAME!}.myshopify.com`;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL}`;

const shopifyApiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION ?? "2026-01";
export const shopifyAdminGql = `${shopifyUrl}/admin/api/${shopifyApiVersion}/graphql.json`;
export const shopifyStorefrontGql = `${shopifyUrl}/api/${shopifyApiVersion}/graphql.json`;

export const tagManagerId = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export const app = {
  url: appUrl,
} as const;

// Internal account API, reached machine-to-machine from server code only.
export const account_api = {
  url: process.env.ACCOUNT_API_URL!,
  m2mClientId: process.env.COGNITO_M2M_CLIENT_ID!,
  m2mClientSecret: process.env.COGNITO_M2M_CLIENT_SECRET!,
  tokenUrl: process.env.COGNITO_TOKEN_URL!,
  scope: "account/write",
} as const;

export const shopify = {
  url: shopifyUrl,
  graphqlUrl: shopifyStorefrontGql,
  publicToken: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN!,
};
export const shopifyAdmin = {
  url: shopifyUrl,
  graphqlUrl: shopifyAdminGql,
  clientId: process.env.SHOPIFY_ADMIN_CLIENT_ID!,
  clientSecret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET!,
} as const;