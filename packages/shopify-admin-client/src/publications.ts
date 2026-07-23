import {shopifyAdminFetch} from "./client";
import {ShopifyUserError, type UserError} from "./errors";

// Sales-channel publication lookup + publishing.
//
// Publishing is separate from a product's `status`: `ProductSetInput` has no
// publications field, so a product created by `productSet` is ACTIVE but on no
// channel, and therefore invisible to the Storefront API. Seeding has to publish
// explicitly, or the storefront sees an empty catalogue.

export interface Publication {
  id: string;
  name: string;
}

interface PublicationsPage {
  publications: {
    nodes: Publication[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
}

const LIST = `
query Publications($first: Int!, $after: String) {
  publications(first: $first, after: $after) {
    nodes { id name }
    pageInfo { hasNextPage endCursor }
  }
}`;

/** Every sales channel the app can see. Needs `read_publications`. */
export async function listPublications(): Promise<Publication[]> {
  const all: Publication[] = [];
  let after: string | null = null;
  for (;;) {
    const data: PublicationsPage = await shopifyAdminFetch(LIST, {first: 100, after});
    all.push(...data.publications.nodes);
    if (!data.publications.pageInfo.hasNextPage) return all;
    after = data.publications.pageInfo.endCursor;
  }
}

/** Channel names are typed by hand in the Shopify admin and carry whatever
 * spacing came with them — the dev headless channel is literally
 * "Forged And Found   Dev Headless". Match on meaning, not on byte equality. */
const normalise = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Resolve a channel by name. Names are what a human configures, but the API
 * needs the id — and a typo would otherwise fail silently at publish time, so
 * an unknown name throws and lists what the store actually has.
 */
export async function publicationIdByName(name: string): Promise<string> {
  const publications = await listPublications();
  const wanted = normalise(name);
  const match = publications.find((p) => normalise(p.name) === wanted);
  if (!match) {
    throw new Error(
      `No sales channel named '${name}'. Available: ${publications.map((p) => p.name).join(", ") || "(none)"}`,
    );
  }
  return match.id;
}

const PUBLISH = `
mutation Publish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable { availablePublicationsCount { count } }
    userErrors { field message }
  }
}`;

/** Publish any publishable (product, collection) to one channel. Idempotent —
 * re-publishing something already on the channel is a no-op. */
export async function publishTo(id: string, publicationId: string): Promise<void> {
  const data = await shopifyAdminFetch<{
    publishablePublish: {userErrors: UserError[]};
  }>(PUBLISH, {id, input: [{publicationId}]});
  const {userErrors} = data.publishablePublish;
  if (userErrors.length) throw new ShopifyUserError(`publishablePublish ${id}`, userErrors);
}
