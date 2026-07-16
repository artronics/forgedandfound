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

/** Convenience wrapper — update only the email. */
export async function updateCustomerEmail(
  id: string,
  email: string,
): Promise<CustomerUpdateResponse> {
  return updateCustomer(id, {email});
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

export interface AddressInput {
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string;
  city: string;
  province?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface CustomerAddressCreateResponse {
  customerAddressCreate: {
    customerAddress?: {
      id: string;
    };
    userErrors: {
      field?: string[];
      message: string;
    }[];
  };
}

export async function createCustomerAddress(
  customerId: string,
  address: AddressInput,
): Promise<CustomerAddressCreateResponse> {
  return await shopifyAdminFetch<CustomerAddressCreateResponse>(
    `
      mutation CreateCustomerAddress($customerId: ID!, $address: MailingAddressInput!) {
        customerAddressCreate(customerId: $customerId, address: $address) {
          customerAddress {
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
      customerId,
      address: {
        firstName: address.firstName,
        lastName: address.lastName,
        address1: address.line1,
        address2: address.line2,
        city: address.city,
        province: address.province,
        zip: address.postalCode,
        country: address.country,
        phone: address.phone,
      },
    },
  );
}
