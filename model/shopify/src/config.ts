// Store identity is hardcoded (name + type); credentials come from env vars and
// are resolved by the CLI, never here. There is intentionally no account/env
// token in any resource name — dev and live schemas are identical (see MODEL.md).

export type StoreType = "dev" | "live";

export interface StoreConfig {
  /** myshopify subdomain, i.e. `<name>.myshopify.com`. */
  name: string;
  type: StoreType;
  /**
   * Sales channel seeded products are published to. Nothing is visible to the
   * Storefront API until it is published to one — an unpublished product is
   * invisible even when its status is ACTIVE, which is why a freshly seeded
   * catalogue looks empty to the frontend.
   */
  publication: string;
}

export const stores: StoreConfig[] = [
  {name: "forged-and-found-dev", type: "dev", publication: "Forged And Found Dev Headless"},
  {name: "forged-and-found-live", type: "live", publication: "Forged And Found Headless"},
];

export function getStore(type: StoreType): StoreConfig {
  const store = stores.find((s) => s.type === type);
  if (!store) {
    throw new Error(`Unknown store type '${type}'. Known: ${stores.map((s) => s.type).join(", ")}`);
  }
  return store;
}
