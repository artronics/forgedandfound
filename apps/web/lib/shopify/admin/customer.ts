import {shopifyAdminFetch} from "./admin-client";

interface CustomerNode {
  id: string;
  email: string;
}

interface CustomersSearchResponse {
  customers: {
    nodes: CustomerNode[];
  };
}

interface CustomerCreateResponse {
  customerCreate: {
    customer?: {
      id: string;
      email: string;
    };
    userErrors: {
      field?: string[];
      message: string;
    }[];
  };
}

export async function getOrCreateCustomer(
  email: string,
): Promise<string> {
  const existingCustomer = await findCustomerByEmail(email);

  if (existingCustomer) {
    return existingCustomer.id;
  }

  return createCustomer(email);
}

async function findCustomerByEmail(
  email: string,
): Promise<CustomerNode | null> {
  const data =
    await shopifyAdminFetch<CustomersSearchResponse>(
      `
      query FindCustomer($query: String!) {
        customers(first: 1, query: $query) {
          nodes {
            id
            email
          }
        }
      }
      `,
      {
        query: `email:${email}`,
      },
    );

  return data.customers.nodes[0] ?? null;
}

async function createCustomer(
  email: string,
): Promise<string> {
  const data =
    await shopifyAdminFetch<CustomerCreateResponse>(
      `
      mutation CreateCustomer($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        input: {
          email,
          emailMarketingConsent: {
            marketingState: "NOT_SUBSCRIBED",
          },
        },
      },
    );

  const result = data.customerCreate;

  if (result.userErrors.length > 0) {
    throw new Error(
      result.userErrors
        .map((e) => e.message)
        .join(", "),
    );
  }

  if (!result.customer) {
    throw new Error(
      "Shopify customer creation returned no customer",
    );
  }

  return result.customer.id;
}