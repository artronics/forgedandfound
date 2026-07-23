// Store identity is hardcoded (name + type); credentials come from env vars and
// are resolved by the CLI, never here. There is intentionally no account/env
// token in any resource name — dev and live schemas are identical (see MODEL.md).

export type StoreType = "dev" | "live";

export interface StoreConfig {
  /** myshopify subdomain, i.e. `<name>.myshopify.com`. */
  name: string;
  type: StoreType;
}

export const stores: StoreConfig[] = [
  {name: "forged-and-found-dev", type: "dev"},
  {name: "forged-and-found-live", type: "live"},
];

export function getStore(type: StoreType): StoreConfig {
  const store = stores.find((s) => s.type === type);
  if (!store) {
    throw new Error(`Unknown store type '${type}'. Known: ${stores.map((s) => s.type).join(", ")}`);
  }
  return store;
}
