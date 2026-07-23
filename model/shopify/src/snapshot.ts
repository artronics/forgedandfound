import {
  listMetafieldDefinitions,
  type MetafieldDefinitionNode,
  type MetafieldOwnerType,
} from "@forgedandfound/shopify-admin-client/metafields";
import {
  listMetaobjectDefinitions,
  type MetaobjectDefinitionNode,
} from "@forgedandfound/shopify-admin-client/metaobjects";

// A full read of the definition schema the migration cares about. Cheap enough
// to capture on every run (including dry-run) as a restore point.

const OWNER_TYPES: MetafieldOwnerType[] = ["PRODUCT", "PRODUCTVARIANT", "COLLECTION"];

export interface CurrentState {
  metaobjects: MetaobjectDefinitionNode[];
  metafields: MetafieldDefinitionNode[];
}

export async function snapshot(): Promise<CurrentState> {
  const metaobjects = await listMetaobjectDefinitions();
  const metafields: MetafieldDefinitionNode[] = [];
  for (const ownerType of OWNER_TYPES) {
    metafields.push(...(await listMetafieldDefinitions(ownerType)));
  }
  return {metaobjects, metafields};
}
