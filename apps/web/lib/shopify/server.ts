import {HttpLink} from "@apollo/client";
import {ApolloClient, InMemoryCache, registerApolloClient} from "@apollo/client-integration-nextjs";
import {shopify} from "@/lib/env";
import {
  GetMenuDocument,
  GetProductByHandleDocument,
  GetProductByHandleQuery,
  GetShopDocument,
  GetShopPoliciesDocument,
  GetShopPoliciesQuery,
  GetShopQuery,
} from "@/graphql/generated/graphql";
import {buildMenu, Menu} from "@/lib/menu/menu";

// Storefront Apollo client for React Server Components. The browser client
// lives in lib/shopify/client/storefront-client.ts.
export const {getClient, query, PreloadQuery} = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: shopify.graphqlUrl,
      headers: {
        "X-Shopify-Storefront-Access-Token": shopify.publicToken,
      },
      fetch,
    }),
  });
});

export async function getMenu(): Promise<Menu[]> {
  const {data} = await query({query: GetMenuDocument});
  return buildMenu(data);
}

type HeroReference = NonNullable<NonNullable<GetShopQuery["shop"]["hero"]>["reference"]>;
export type HeroImage = NonNullable<Extract<HeroReference, { __typename: "MediaImage" }>["image"]>;

export async function getHeroImage(): Promise<HeroImage | null> {
  const {data} = await query({
    query: GetShopDocument,
    variables: {namespace: "ff_shop", heroKey: "hero_image"},
  });
  const reference = data?.shop.hero?.reference;
  if (reference?.__typename !== "MediaImage") return null;
  return reference.image ?? null;
}

export type PolicyKind = "privacyPolicy" | "termsOfService" | "refundPolicy" | "shippingPolicy";
export type Policy = GetShopPoliciesQuery["shop"][PolicyKind];

export async function getPolicy(kind: PolicyKind): Promise<Policy> {
  const {data} = await query({query: GetShopPoliciesDocument});
  return data?.shop[kind] ?? null;
}

export async function getProduct(handle: string): Promise<GetProductByHandleQuery["product"]> {
  const {data} = await query({
    query: GetProductByHandleDocument,
    variables: {handle},
  });
  return data?.product ?? null;
}
