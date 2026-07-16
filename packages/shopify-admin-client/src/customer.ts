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

interface EmailMarketingConsentInput {
  marketingState: "SUBSCRIBED" | "NOT_SUBSCRIBED" | "PENDING" | "UNSUBSCRIBED";
  marketingOptInLevel?: "SINGLE_OPT_IN" | "CONFIRMED_OPT_IN" | "UNKNOWN";
  consentUpdatedAt?: string;
}

export interface CreateCustomerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  emailMarketingConsent?: EmailMarketingConsentInput;
}

export async function createCustomer(
  input: CreateCustomerInput,
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
