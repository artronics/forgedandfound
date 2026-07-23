import {shopifyAdminFetch} from "./client";
import {ShopifyUserError, type UserError} from "./errors";

// Metafield *definition* administration (create/update/delete/list). Definitions
// are the schema — the typed slots products/variants/collections can hold. Their
// namespace+key+ownerType is immutable identity: a "rename" is delete+recreate.

export type MetafieldOwnerType = "PRODUCT" | "PRODUCTVARIANT" | "COLLECTION";

export interface MetafieldValidation {
  name: string;
  value: string | null;
}

export interface MetafieldDefinitionNode {
  id: string;
  namespace: string;
  key: string;
  name: string;
  description: string | null;
  type: {name: string};
  ownerType: MetafieldOwnerType;
  validations: MetafieldValidation[];
}

const LIST = `
query MetafieldDefs($ownerType: MetafieldOwnerType!, $first: Int!, $after: String) {
  metafieldDefinitions(ownerType: $ownerType, first: $first, after: $after) {
    nodes { id namespace key name description type { name } ownerType validations { name value } }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface MetafieldDefinitionsPage {
  metafieldDefinitions: {
    nodes: MetafieldDefinitionNode[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
}

/** All metafield definitions for one owner type, following pagination. */
export async function listMetafieldDefinitions(
  ownerType: MetafieldOwnerType,
): Promise<MetafieldDefinitionNode[]> {
  const out: MetafieldDefinitionNode[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: MetafieldDefinitionsPage = await shopifyAdminFetch(LIST, {ownerType, first: 250, after});
    out.push(...data.metafieldDefinitions.nodes);
    hasNext = data.metafieldDefinitions.pageInfo.hasNextPage;
    after = data.metafieldDefinitions.pageInfo.endCursor;
  }
  return out;
}

export interface MetafieldValidationInput {
  name: string;
  value: string;
}

export interface MetafieldAccessInput {
  storefront?: "PUBLIC_READ" | "NONE";
}

export interface CreateMetafieldDefinitionInput {
  name: string;
  namespace: string;
  key: string;
  description?: string;
  type: string; // e.g. "metaobject_reference", "list.metaobject_reference"
  ownerType: MetafieldOwnerType;
  validations?: MetafieldValidationInput[];
  access?: MetafieldAccessInput;
  pin?: boolean;
}

const CREATE = `
mutation CreateMetafieldDef($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition { id namespace key }
    userErrors { field message code }
  }
}`;

export async function createMetafieldDefinition(
  input: CreateMetafieldDefinitionInput,
): Promise<{id: string; namespace: string; key: string}> {
  const data = await shopifyAdminFetch<{
    metafieldDefinitionCreate: {
      createdDefinition: {id: string; namespace: string; key: string} | null;
      userErrors: UserError[];
    };
  }>(CREATE, {definition: input});
  const {createdDefinition, userErrors} = data.metafieldDefinitionCreate;
  if (userErrors.length || !createdDefinition) {
    throw new ShopifyUserError(`metafieldDefinitionCreate custom.${input.key}`, userErrors);
  }
  return createdDefinition;
}

export interface UpdateMetafieldDefinitionInput {
  namespace: string;
  key: string;
  ownerType: MetafieldOwnerType;
  name?: string;
  description?: string;
  validations?: MetafieldValidationInput[];
  access?: MetafieldAccessInput;
  pin?: boolean;
}

const UPDATE = `
mutation UpdateMetafieldDef($definition: MetafieldDefinitionUpdateInput!) {
  metafieldDefinitionUpdate(definition: $definition) {
    updatedDefinition { id }
    userErrors { field message code }
  }
}`;

export async function updateMetafieldDefinition(
  input: UpdateMetafieldDefinitionInput,
): Promise<{id: string}> {
  const data = await shopifyAdminFetch<{
    metafieldDefinitionUpdate: {
      updatedDefinition: {id: string} | null;
      userErrors: UserError[];
    };
  }>(UPDATE, {definition: input});
  const {updatedDefinition, userErrors} = data.metafieldDefinitionUpdate;
  if (userErrors.length || !updatedDefinition) {
    throw new ShopifyUserError(`metafieldDefinitionUpdate custom.${input.key}`, userErrors);
  }
  return updatedDefinition;
}

const DELETE = `
mutation DeleteMetafieldDef($id: ID!, $deleteAllAssociatedMetafields: Boolean!) {
  metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: $deleteAllAssociatedMetafields) {
    deletedDefinitionId
    userErrors { field message code }
  }
}`;

/**
 * Delete a definition. `deleteAllAssociatedMetafields=true` wipes every value
 * that used it (irreversible); `false` orphans the raw metafields (recoverable
 * by recreating the definition). The migration passes `true` only on an
 * explicit destructive run.
 */
export async function deleteMetafieldDefinition(
  id: string,
  deleteAllAssociatedMetafields: boolean,
): Promise<string> {
  const data = await shopifyAdminFetch<{
    metafieldDefinitionDelete: {
      deletedDefinitionId: string | null;
      userErrors: UserError[];
    };
  }>(DELETE, {id, deleteAllAssociatedMetafields});
  const {deletedDefinitionId, userErrors} = data.metafieldDefinitionDelete;
  if (userErrors.length || !deletedDefinitionId) {
    throw new ShopifyUserError(`metafieldDefinitionDelete ${id}`, userErrors);
  }
  return deletedDefinitionId;
}
