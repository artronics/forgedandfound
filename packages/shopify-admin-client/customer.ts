import type {CreateCustomerInput} from "./src/customer";
import {createCustomer, findCustomerByEmail} from "./src/customer";

export {
  createCustomer,
  findCustomerByEmail,
};

export type {CreateCustomerInput};
