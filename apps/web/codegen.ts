import type {CodegenConfig} from "@graphql-codegen/cli";

const storeName = process.env.NEXT_PUBLIC_SHOPIFY_STORE_NAME;
const shopifyApiVersion = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION ?? "2026-01";

// When Shopify credentials are present (CI / Vercel), introspect the live
// schema; otherwise fall back to the checked-in snapshot so codegen and
// typechecking work without secrets.
const storefrontSchema = storeName
  ? {
    [`https://${storeName}.myshopify.com/api/${shopifyApiVersion}/graphql.json`]: {
      headers: {
        "X-Shopify-Storefront-Access-Token": process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN!,
      },
    },
  }
  : "./storefront.schema.graphql";

const config: CodegenConfig = {
  schema: [
    storefrontSchema,
    {"./graphql/schema.graphqls": {}},
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
