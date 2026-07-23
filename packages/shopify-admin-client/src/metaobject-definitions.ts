import {shopifyAdminFetch} from "./client";
import {ShopifyUserError, type UserError} from "./errors";
import type {MetafieldValidation, MetafieldValidationInput} from "./metafield-definitions";

// Metaobject *definition* administration. A metaobject definition is a reusable
// structured type (e.g. `jewellery_finish` with material/purity/colour fields).
// The `type` handle is immutable identity. Entries (rows) are managed separately
// via `upsertMetaobject`.

export interface MetaobjectFieldDefinitionNode {
  key: string;
  name: string;
  description: string | null;
  type: {name: string};
  required: boolean;
  validations: MetafieldValidation[];
}

export interface MetaobjectDefinitionNode {
  id: string;
  type: string;
  name: string;
  description: string | null;
  fieldDefinitions: MetaobjectFieldDefinitionNode[];
  access: {storefront: string | null};
}

const LIST = `
query MetaobjectDefs($first: Int!, $after: String) {
  metaobjectDefinitions(first: $first, after: $after) {
    nodes {
      id type name description
      access { storefront }
      fieldDefinitions { key name description type { name } required validations { name value } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface MetaobjectDefinitionsPage {
  metaobjectDefinitions: {
    nodes: MetaobjectDefinitionNode[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
}

export async function listMetaobjectDefinitions(): Promise<MetaobjectDefinitionNode[]> {
  const out: MetaobjectDefinitionNode[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: MetaobjectDefinitionsPage = await shopifyAdminFetch(LIST, {first: 250, after});
    out.push(...data.metaobjectDefinitions.nodes);
    hasNext = data.metaobjectDefinitions.pageInfo.hasNextPage;
    after = data.metaobjectDefinitions.pageInfo.endCursor;
  }
  return out;
}

export interface MetaobjectFieldDefinitionInput {
  key: string;
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  validations?: MetafieldValidationInput[];
}

export interface CreateMetaobjectDefinitionInput {
  type: string;
  name: string;
  description?: string;
  access?: {storefront?: "PUBLIC_READ" | "NONE"};
  capabilities?: {publishable?: {enabled: boolean}};
  fieldDefinitions: MetaobjectFieldDefinitionInput[];
}

const CREATE = `
mutation CreateMetaobjectDef($definition: MetaobjectDefinitionCreateInput!) {
  metaobjectDefinitionCreate(definition: $definition) {
    metaobjectDefinition { id type }
    userErrors { field message code }
  }
}`;

export async function createMetaobjectDefinition(
  input: CreateMetaobjectDefinitionInput,
): Promise<{id: string; type: string}> {
  const data = await shopifyAdminFetch<{
    metaobjectDefinitionCreate: {
      metaobjectDefinition: {id: string; type: string} | null;
      userErrors: UserError[];
    };
  }>(CREATE, {definition: input});
  const {metaobjectDefinition, userErrors} = data.metaobjectDefinitionCreate;
  if (userErrors.length || !metaobjectDefinition) {
    throw new ShopifyUserError(`metaobjectDefinitionCreate ${input.type}`, userErrors);
  }
  return metaobjectDefinition;
}

// Field-level operations on update are a tagged union: exactly one of
// create/update/delete per entry.
export interface MetaobjectFieldOperationInput {
  create?: MetaobjectFieldDefinitionInput;
  update?: {key: string; name?: string; description?: string; required?: boolean; validations?: MetafieldValidationInput[]};
  delete?: {key: string};
}

export interface UpdateMetaobjectDefinitionInput {
  name?: string;
  description?: string;
  access?: {storefront?: "PUBLIC_READ" | "NONE"};
  fieldDefinitions?: MetaobjectFieldOperationInput[];
}

const UPDATE = `
mutation UpdateMetaobjectDef($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
  metaobjectDefinitionUpdate(id: $id, definition: $definition) {
    metaobjectDefinition { id }
    userErrors { field message code }
  }
}`;

export async function updateMetaobjectDefinition(
  id: string,
  input: UpdateMetaobjectDefinitionInput,
): Promise<{id: string}> {
  const data = await shopifyAdminFetch<{
    metaobjectDefinitionUpdate: {
      metaobjectDefinition: {id: string} | null;
      userErrors: UserError[];
    };
  }>(UPDATE, {id, definition: input});
  const {metaobjectDefinition, userErrors} = data.metaobjectDefinitionUpdate;
  if (userErrors.length || !metaobjectDefinition) {
    throw new ShopifyUserError(`metaobjectDefinitionUpdate ${id}`, userErrors);
  }
  return metaobjectDefinition;
}

const DELETE = `
mutation DeleteMetaobjectDef($id: ID!) {
  metaobjectDefinitionDelete(id: $id) {
    deletedId
    userErrors { field message code }
  }
}`;

/** Delete a definition. Cascades to every entry of that type (irreversible). */
export async function deleteMetaobjectDefinition(id: string): Promise<string> {
  const data = await shopifyAdminFetch<{
    metaobjectDefinitionDelete: {deletedId: string | null; userErrors: UserError[]};
  }>(DELETE, {id});
  const {deletedId, userErrors} = data.metaobjectDefinitionDelete;
  if (userErrors.length || !deletedId) {
    throw new ShopifyUserError(`metaobjectDefinitionDelete ${id}`, userErrors);
  }
  return deletedId;
}

// --- Entries (rows) — used in Phase 3 seeding, upsert is idempotent by handle ---

export interface UpsertMetaobjectInput {
  fields: {key: string; value: string}[];
  capabilities?: {publishable?: {status: "ACTIVE" | "DRAFT"}};
}

const UPSERT = `
mutation UpsertMetaobject($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
  metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
    metaobject { id handle }
    userErrors { field message code }
  }
}`;

interface MetaobjectsPage {
  metaobjects: {
    nodes: {id: string; handle: string}[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
}

const LIST_ENTRIES = `
query MetaobjectsByType($type: String!, $first: Int!, $after: String) {
  metaobjects(type: $type, first: $first, after: $after) {
    nodes { id handle }
    pageInfo { hasNextPage endCursor }
  }
}`;

/** All entries of a metaobject type as {id, handle} — for resolving handle → GID. */
export async function listMetaobjects(type: string): Promise<{id: string; handle: string}[]> {
  const out: {id: string; handle: string}[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: MetaobjectsPage = await shopifyAdminFetch(LIST_ENTRIES, {type, first: 250, after});
    out.push(...data.metaobjects.nodes);
    hasNext = data.metaobjects.pageInfo.hasNextPage;
    after = data.metaobjects.pageInfo.endCursor;
  }
  return out;
}

export interface MetaobjectEntry {
  id: string;
  handle: string;
  /** Field key → value. Reference fields resolve to the referenced entry's
   * handle rather than its GID, so callers can match on model handles. */
  fields: Record<string, string>;
}

interface EntriesPage {
  metaobjects: {
    nodes: {
      id: string;
      handle: string;
      fields: {key: string; value: string | null; reference: {handle?: string} | null}[];
    }[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
}

const LIST_ENTRIES_WITH_FIELDS = `
query MetaobjectEntries($type: String!, $first: Int!, $after: String) {
  metaobjects(type: $type, first: $first, after: $after) {
    nodes {
      id
      handle
      fields { key value reference { ... on Metaobject { handle } } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/** All entries of a type with their field values — for matching source data
 * against a curated vocabulary. */
export async function listMetaobjectEntries(type: string): Promise<MetaobjectEntry[]> {
  const out: MetaobjectEntry[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: EntriesPage = await shopifyAdminFetch(LIST_ENTRIES_WITH_FIELDS, {
      type,
      first: 250,
      after,
    });
    for (const node of data.metaobjects.nodes) {
      const fields: Record<string, string> = {};
      for (const f of node.fields) {
        const value = f.reference?.handle ?? f.value;
        if (value != null && value !== "") fields[f.key] = value;
      }
      out.push({id: node.id, handle: node.handle, fields});
    }
    hasNext = data.metaobjects.pageInfo.hasNextPage;
    after = data.metaobjects.pageInfo.endCursor;
  }
  return out;
}

/** Create-or-update a metaobject entry keyed by (type, handle). Idempotent. */
export async function upsertMetaobject(
  type: string,
  handle: string,
  input: UpsertMetaobjectInput,
): Promise<{id: string; handle: string}> {
  const data = await shopifyAdminFetch<{
    metaobjectUpsert: {
      metaobject: {id: string; handle: string} | null;
      userErrors: UserError[];
    };
  }>(UPSERT, {handle: {type, handle}, metaobject: input});
  const {metaobject, userErrors} = data.metaobjectUpsert;
  if (userErrors.length || !metaobject) {
    throw new ShopifyUserError(`metaobjectUpsert ${type}:${handle}`, userErrors);
  }
  return metaobject;
}
