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
  requestCustomerDataErasure,
  updateCustomer,
  updateCustomerEmail,
  updateCustomerEmailMarketingConsent,
} from "./src/customer";

export {
  createCustomer,
  createCustomerAddress,
  findCustomerByEmail,
  requestCustomerDataErasure,
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
