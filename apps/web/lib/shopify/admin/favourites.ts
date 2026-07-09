import {shopifyAdminFetch} from "./admin-client";

const NAMESPACE = "custom";
const KEY = "wishlist";

interface CustomerMetafieldResponse {
  customer: {
    metafield: { value: string } | null;
  } | null;
}

export async function getCustomerFavourites(customerId: string): Promise<string[]> {
  const data = await shopifyAdminFetch<CustomerMetafieldResponse>(
    `query GetFavourites($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
          value
        }
      }
    }`,
    {id: customerId},
  );

  const raw = data.customer?.metafield?.value;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function setCustomerFavourites(customerId: string, ids: string[]): Promise<void> {
  await shopifyAdminFetch<unknown>(
    `mutation SetFavourites($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId: customerId,
          namespace: NAMESPACE,
          key: KEY,
          type: "list.product_reference",
          value: JSON.stringify(ids),
        },
      ],
    },
  );
}
