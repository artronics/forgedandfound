import {shopifyAdminFetch} from "./client";

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

export async function findCustomerByEmail(
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

export async function createCustomer(
  input: { email: string, firstName?: string, lastName?: string },
): Promise<CustomerCreateResponse> {
  return await shopifyAdminFetch<CustomerCreateResponse>(
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
      input,
    },
  );
}
