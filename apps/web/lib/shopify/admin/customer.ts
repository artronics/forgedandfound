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

interface CustomerRequestDataErasureResponse {
  customerRequestDataErasure: {
    customerId?: string;
    userErrors: {
      field?: string[];
      message: string;
    }[];
  };
}

/**
 * Ask Shopify to erase the customer's personal data (the GDPR redaction flow).
 * Preferred over `customerDelete` for account deletion: it succeeds even when
 * the customer has order history — Shopify redacts the PII after its grace
 * period instead of refusing.
 */
export async function requestCustomerDataErasure(
  customerId: string,
): Promise<void> {
  const data =
    await shopifyAdminFetch<CustomerRequestDataErasureResponse>(
      `
      mutation RequestCustomerErasure($customerId: ID!) {
        customerRequestDataErasure(customerId: $customerId) {
          customerId
          userErrors {
            field
            message
          }
        }
      }
      `,
      {customerId},
    );

  const errors = data.customerRequestDataErasure.userErrors;
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