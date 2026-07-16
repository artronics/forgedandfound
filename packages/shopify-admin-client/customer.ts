import type {
  AddressInput,
  CreateCustomerInput,
  EmailMarketingConsentInput,
  EmailMarketingConsentUpdateInput,
  UpdateCustomerInput,
} from "./src/customer";
import {
  createCustomer,
  createCustomerAddress,
  findCustomerByEmail,
  updateCustomer,
  updateCustomerEmail,
  updateCustomerEmailMarketingConsent,
} from "./src/customer";

export {
  createCustomer,
  createCustomerAddress,
  findCustomerByEmail,
  updateCustomer,
  updateCustomerEmail,
  updateCustomerEmailMarketingConsent,
};

export type {
  AddressInput,
  CreateCustomerInput,
  EmailMarketingConsentInput,
  EmailMarketingConsentUpdateInput,
  UpdateCustomerInput,
};
