import {shopifyAdminFetch} from "./client";
import {ShopifyUserError, type UserError} from "./errors";

// Smart-collection administration, plus the one metafield-definition capability
// that makes our custom metafields usable as collection rules.
//
// A Shopify smart collection is a saved rule set: products are matched
// automatically, so a collection defined by `custom.design == choker` stays
// correct as products come and go. But a metafield can only appear in a rule if
// its definition has the `smartCollectionCondition` capability enabled — that is
// what the admin UI silently requires, and why only Shopify's own metaobjects
// show up until we turn ours on.

export type MetafieldOwnerType = "PRODUCT" | "PRODUCTVARIANT" | "COLLECTION";

export interface MetafieldDefinitionCapability {
  id: string;
  key: string;
  smartCollectionCondition: {eligible: boolean; enabled: boolean};
}

const LIST_DEFS_WITH_CAPS = `
query DefsWithCaps($ownerType: MetafieldOwnerType!, $namespace: String!, $first: Int!, $after: String) {
  metafieldDefinitions(ownerType: $ownerType, namespace: $namespace, first: $first, after: $after) {
    nodes {
      id key
      capabilities { smartCollectionCondition { eligible enabled } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface DefsWithCapsPage {
  metafieldDefinitions: {
    nodes: {id: string; key: string; capabilities: {smartCollectionCondition: {eligible: boolean; enabled: boolean}}}[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
}

/** Definitions in a namespace with their smart-collection capability — the
 * lookup a collection needs (a rule references a definition by GID) and the
 * check that says whether the capability still has to be enabled. */
export async function listDefinitionsWithCapabilities(
  ownerType: MetafieldOwnerType,
  namespace: string,
): Promise<MetafieldDefinitionCapability[]> {
  const out: MetafieldDefinitionCapability[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: DefsWithCapsPage = await shopifyAdminFetch(LIST_DEFS_WITH_CAPS, {
      ownerType,
      namespace,
      first: 250,
      after,
    });
    for (const n of data.metafieldDefinitions.nodes) {
      out.push({id: n.id, key: n.key, smartCollectionCondition: n.capabilities.smartCollectionCondition});
    }
    hasNext = data.metafieldDefinitions.pageInfo.hasNextPage;
    after = data.metafieldDefinitions.pageInfo.endCursor;
  }
  return out;
}

const ENABLE_CONDITION = `
mutation EnableCondition($definition: MetafieldDefinitionUpdateInput!) {
  metafieldDefinitionUpdate(definition: $definition) {
    updatedDefinition { id capabilities { smartCollectionCondition { enabled } } }
    userErrors { field message }
  }
}`;

/** Turn on the smart-collection-condition capability for one definition. Only
 * eligible definitions can be enabled; re-enabling an enabled one is a no-op. */
export async function enableSmartCollectionCondition(
  ownerType: MetafieldOwnerType,
  namespace: string,
  key: string,
): Promise<void> {
  const data = await shopifyAdminFetch<{
    metafieldDefinitionUpdate: {updatedDefinition: {id: string} | null; userErrors: UserError[]};
  }>(ENABLE_CONDITION, {
    definition: {ownerType, namespace, key, capabilities: {smartCollectionCondition: {enabled: true}}},
  });
  const {updatedDefinition, userErrors} = data.metafieldDefinitionUpdate;
  if (userErrors.length || !updatedDefinition) {
    throw new ShopifyUserError(`enable smartCollectionCondition custom.${key}`, userErrors);
  }
}

export type CollectionRuleColumn =
  | "PRODUCT_CATEGORY_ID"
  | "PRODUCT_METAFIELD_DEFINITION"
  | "VARIANT_METAFIELD_DEFINITION"
  | "TAG"
  | "TYPE";

export type CollectionRuleRelation = "EQUALS" | "NOT_EQUALS" | "CONTAINS";

export interface CollectionRule {
  column: CollectionRuleColumn;
  relation: CollectionRuleRelation;
  condition: string;
  /** The metafield *definition* GID, required for metafield rules. */
  conditionObjectId?: string;
}

export interface SmartCollection {
  id: string;
  handle: string;
  title: string;
  ruleSet: {appliedDisjunctively: boolean; rules: CollectionRule[]} | null;
}

const LIST_COLLECTIONS = `
query Collections($first: Int!, $after: String) {
  collections(first: $first, after: $after) {
    nodes {
      id handle title
      ruleSet { appliedDisjunctively rules { column relation condition } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface CollectionsPage {
  collections: {nodes: SmartCollection[]; pageInfo: {hasNextPage: boolean; endCursor: string | null}};
}

/** Every collection as {id, handle, ruleSet} — for upsert-by-handle. */
export async function listCollections(): Promise<SmartCollection[]> {
  const out: SmartCollection[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: CollectionsPage = await shopifyAdminFetch(LIST_COLLECTIONS, {first: 250, after});
    out.push(...data.collections.nodes);
    hasNext = data.collections.pageInfo.hasNextPage;
    after = data.collections.pageInfo.endCursor;
  }
  return out;
}

export interface CollectionInput {
  handle: string;
  title: string;
  descriptionHtml?: string;
  appliedDisjunctively: boolean;
  rules: CollectionRule[];
}

function ruleSetInput(input: CollectionInput) {
  return {
    appliedDisjunctively: input.appliedDisjunctively,
    rules: input.rules.map((r) => ({
      column: r.column,
      relation: r.relation,
      condition: r.condition,
      ...(r.conditionObjectId ? {conditionObjectId: r.conditionObjectId} : {}),
    })),
  };
}

const CREATE = `
mutation CreateCollection($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection { id handle }
    userErrors { field message }
  }
}`;

const UPDATE = `
mutation UpdateCollection($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    collection { id handle }
    userErrors { field message }
  }
}`;

/** Create a collection, or update the one already on this handle. Membership is
 * recomputed by Shopify asynchronously, so it may lag the call by seconds. */
export async function upsertSmartCollection(
  input: CollectionInput,
  existingId: string | null,
): Promise<{id: string; created: boolean}> {
  const payload = {
    ...(existingId ? {id: existingId} : {}),
    handle: input.handle,
    title: input.title,
    ...(input.descriptionHtml ? {descriptionHtml: input.descriptionHtml} : {}),
    ruleSet: ruleSetInput(input),
  };
  if (existingId) {
    const data = await shopifyAdminFetch<{
      collectionUpdate: {collection: {id: string} | null; userErrors: UserError[]};
    }>(UPDATE, {input: payload});
    const {collection, userErrors} = data.collectionUpdate;
    if (userErrors.length || !collection) {
      throw new ShopifyUserError(`collectionUpdate ${input.handle}`, userErrors);
    }
    return {id: collection.id, created: false};
  }
  const data = await shopifyAdminFetch<{
    collectionCreate: {collection: {id: string} | null; userErrors: UserError[]};
  }>(CREATE, {input: payload});
  const {collection, userErrors} = data.collectionCreate;
  if (userErrors.length || !collection) {
    throw new ShopifyUserError(`collectionCreate ${input.handle}`, userErrors);
  }
  return {id: collection.id, created: true};
}
