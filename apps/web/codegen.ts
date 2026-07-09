import type {CodegenConfig} from "@graphql-codegen/cli";

const shopifyUrl = `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_NAME!}.myshopify.com`;
const shopifyApiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION ?? "2026-01";
const graphqlUrl = `${shopifyUrl}/api/${shopifyApiVersion}/graphql.json`;

const storefrontAccessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN!;

const config: CodegenConfig = {
  schema: [
    {
      [graphqlUrl]: {
        headers: {
          "X-Shopify-Storefront-Access-Token": storefrontAccessToken,
        },
      },
    }, {
      "./graphql/schema.graphqls": {},
    },
  ],
  documents: [
    "app/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx,graphql}",
    "graphql/**/*.{graphql,graphqls,ts,tsx}",
  ],
  generates: {
    "./graphql/generated/": {
      preset: "client",
      config: {
        avoidOptionals: {
          field: true,
          inputValue: false,
        },
        nonOptionalTypename: true,
        skipTypeNameForRoot: true,
        skipTypename: true,
        enumsAsTypes: true,
      },
      presetConfig: {
        enumsAsTypes: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;