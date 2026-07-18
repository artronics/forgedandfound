import type {
  CreateCustomerInput,
  EmailMarketingConsentInput,
  EmailMarketingConsentUpdateInput,
  UpdateCustomerInput,
} from "./src/customer";
import {
  createCustomer,
  findCustomerByEmail,
  updateCustomer,
  updateCustomerEmailMarketingConsent,
} from "./src/customer";

export {
  createCustomer,
  findCustomerByEmail,
  updateCustomer,
  updateCustomerEmailMarketingConsent,
};

export type {
  CreateCustomerInput,
  EmailMarketingConsentInput,
  EmailMarketingConsentUpdateInput,
  UpdateCustomerInput,
};
