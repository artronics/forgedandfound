import {getAdminAccessToken, getAdminGraphqlUrl} from "./auth";

export async function shopifyAdminFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = await getAdminAccessToken();
  const response = await fetch(
    await getAdminGraphqlUrl(),
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Shopify GraphQL error: ${response.status}`,
    );
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(
      JSON.stringify(json.errors),
    );
  }

  return json.data;
}
