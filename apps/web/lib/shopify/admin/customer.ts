import {shopifyAdminFetch} from "./admin-client";

interface CustomerNode {
  id: string;
  email: string;
}

interface CustomerByIdentifierResponse {
  customerByIdentifier: CustomerNode | null;
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

  try {
    return await createCustomer(email);
  } catch (err) {
    // The customer may have been created between our lookup and the create
    // (e.g. by the PreSignUp Lambda during this same sign-in) — re-find before
    // giving up.
    const raced = await findCustomerByEmail(email);
    if (raced) return raced.id;
    throw err;
  }
}

/**
 * Exact identifier lookup, NOT the `customers(query:)` search — the search
 * index is eventually consistent and misses customers created moments ago,
 * while customerCreate's uniqueness check sees them immediately.
 */
export async function findCustomerByEmail(
  email: string,
): Promise<CustomerNode | null> {
  const data =
    await shopifyAdminFetch<CustomerByIdentifierResponse>(
      `
      query FindCustomer($identifier: CustomerIdentifierInput!) {
        customerByIdentifier(identifier: $identifier) {
          id
          email
        }
      }
      `,
      {
        identifier: {emailAddress: email},
      },
    );

  return data.customerByIdentifier ?? null;
}

export interface CustomerProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  emailMarketingConsent: {
    marketingState: string;
  } | null;
}

interface CustomerProfileResponse {
  customer: CustomerProfile | null;
}

/** The customer fields shown on the account page, consent state included. */
export async function getCustomerProfile(
  customerId: string,
): Promise<CustomerProfile | null> {
  const data = await shopifyAdminFetch<CustomerProfileResponse>(
    `
    query CustomerProfile($id: ID!) {
      customer(id: $id) {
        id
        email
        firstName
        lastName
        emailMarketingConsent {
          marketingState
        }
      }
    }
    `,
    {id: customerId},
  );

  return data.customer ?? null;
}

interface CustomerUpdateResponse {
  customerUpdate: {
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
 * Mirror profile changes (name, email) from Cognito — the source of truth —
 * onto the Shopify customer. Throws with the joined userError messages.
 */
export async function updateCustomerProfile(
  customerId: string,
  fields: { firstName?: string; lastName?: string; email?: string },
): Promise<void> {
  const data = await shopifyAdminFetch<CustomerUpdateResponse>(
    `
    mutation UpdateCustomer($input: CustomerInput!) {
      customerUpdate(input: $input) {
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
    {input: {id: customerId, ...fields}},
  );

  const errors = data.customerUpdate.userErrors;
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
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
 * Set the customer's email-marketing consent. NOT_SUBSCRIBED is only valid at
 * customer creation, so opting out here always means UNSUBSCRIBED. Throws with
 * the joined userError messages.
 */
export async function updateCustomerMarketingConsent(
  customerId: string,
  subscribed: boolean,
): Promise<void> {
  const data = await shopifyAdminFetch<CustomerEmailMarketingConsentUpdateResponse>(
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
      input: {
        customerId,
        emailMarketingConsent: {
          marketingState: subscribed ? "SUBSCRIBED" : "UNSUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN",
          consentUpdatedAt: new Date().toISOString(),
        },
      },
    },
  );

  const errors = data.customerEmailMarketingConsentUpdate.userErrors;
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
}

interface CustomerDeleteResponse {
  customerDelete: {
    deletedCustomerId?: string;
    userErrors: {
      field?: string[];
      message: string;
    }[];
  };
}

/**
 * Delete the Shopify customer record on account deletion.
 *
 * NOTE: this is a plain delete, not the GDPR `customerRequestDataErasure`
 * redaction flow — that requires the app to hold protected customer data
 * access, which we don't have yet. TODO: switch to customerRequestDataErasure
 * once those permissions are granted, so deletion also works for customers with
 * order history (which customerDelete refuses).
 */
export async function deleteCustomer(
  customerId: string,
): Promise<void> {
  const data =
    await shopifyAdminFetch<CustomerDeleteResponse>(
      `
      mutation DeleteCustomer($id: ID!) {
        customerDelete(input: {id: $id}) {
          deletedCustomerId
          userErrors {
            field
            message
          }
        }
      }
      `,
      {id: customerId},
    );

  const errors = data.customerDelete.userErrors;
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }
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