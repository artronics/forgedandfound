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

export interface EmailMarketingConsentInput {
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

interface CustomerUpdateResponse {
  customerUpdate: {
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

export interface UpdateCustomerInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export async function updateCustomer(
  id: string,
  fields: UpdateCustomerInput,
): Promise<CustomerUpdateResponse> {
  return await shopifyAdminFetch<CustomerUpdateResponse>(
    `
      mutation UpdateCustomer($input: CustomerInput!) {
        customerUpdate(input: $input) {
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
      input: {id, ...fields},
    },
  );
}

interface CustomerEmailMarketingConsentUpdateResponse {
  customerEmailMarketingConsentUpdate: {
    customer?: {
      id: string;
    };
    userErrors: {
      field?: string[];
      message: string;
    }[];
  };
}

/**
 * Consent states Shopify accepts when *updating*. NOT_SUBSCRIBED is deliberately
 * absent: it's the "never subscribed" initial state and is only valid on create —
 * sending it here fails with "Cannot specify NOT_SUBSCRIBED as a marketing state
 * input". Use UNSUBSCRIBED to opt someone out.
 */
export interface EmailMarketingConsentUpdateInput {
  marketingState: "SUBSCRIBED" | "UNSUBSCRIBED" | "PENDING";
  marketingOptInLevel?: "SINGLE_OPT_IN" | "CONFIRMED_OPT_IN" | "UNKNOWN";
  consentUpdatedAt?: string;
}

/**
 * Update marketing consent. Shopify rejects `emailMarketingConsent` on
 * `customerUpdate`, so it has its own mutation.
 */
export async function updateCustomerEmailMarketingConsent(
  customerId: string,
  emailMarketingConsent: EmailMarketingConsentUpdateInput,
): Promise<CustomerEmailMarketingConsentUpdateResponse> {
  return await shopifyAdminFetch<CustomerEmailMarketingConsentUpdateResponse>(
    `
      mutation UpdateEmailConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
        customerEmailMarketingConsentUpdate(input: $input) {
          customer {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
    {
      input: {customerId, emailMarketingConsent},
    },
  );
}
