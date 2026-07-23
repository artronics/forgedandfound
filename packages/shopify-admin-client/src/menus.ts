import {shopifyAdminFetch} from "./client";
import {ShopifyUserError, type UserError} from "./errors";

// Online Store navigation menus.
//
// A menu is the one Shopify resource that nests natively, and the Storefront API
// serves it back via `menu(handle:)` — so a headless storefront can read its nav
// from here instead of hardcoding one. Shopify allows sub-items up to three
// levels deep.
//
// Items are replaced wholesale on update rather than patched: the spec is the
// desired state, and diffing a tree by identity would mean inventing stable ids
// for nodes the spec doesn't name.

export type MenuItemType =
  | "COLLECTION"
  | "COLLECTIONS"
  | "HTTP"
  | "PRODUCT"
  | "PAGE"
  | "SEARCH"
  | "FRONTPAGE"
  | "METAOBJECT";

export interface MenuItemInput {
  title: string;
  type: MenuItemType;
  /** For resource-backed items (a COLLECTION item's collection GID). */
  resourceId?: string;
  /** For HTTP items — a filter link, or `#` for a heading. */
  url?: string;
  items?: MenuItemInput[];
}

export interface MenuNode {
  id: string;
  handle: string;
  title: string;
  isDefault: boolean;
  items: {id: string; title: string; type: string; url: string | null; resourceId: string | null}[];
}

const LIST = `
query Menus($first: Int!, $after: String) {
  menus(first: $first, after: $after) {
    nodes {
      id handle title isDefault
      items { id title type url resourceId }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

interface MenusPage {
  menus: {nodes: MenuNode[]; pageInfo: {hasNextPage: boolean; endCursor: string | null}};
}

/** Every menu, for upsert-by-handle. Only top-level items are read back — enough
 * to identify the menu; the spec is authoritative for the tree. */
export async function listMenus(): Promise<MenuNode[]> {
  const out: MenuNode[] = [];
  let after: string | null = null;
  let hasNext = true;
  while (hasNext) {
    const data: MenusPage = await shopifyAdminFetch(LIST, {first: 250, after});
    out.push(...data.menus.nodes);
    hasNext = data.menus.pageInfo.hasNextPage;
    after = data.menus.pageInfo.endCursor;
  }
  return out;
}

const CREATE = `
mutation CreateMenu($handle: String!, $title: String!, $items: [MenuItemCreateInput!]!) {
  menuCreate(handle: $handle, title: $title, items: $items) {
    menu { id handle }
    userErrors { field message }
  }
}`;

const UPDATE = `
mutation UpdateMenu($id: ID!, $handle: String, $title: String!, $items: [MenuItemUpdateInput!]!) {
  menuUpdate(id: $id, handle: $handle, title: $title, items: $items) {
    menu { id handle }
    userErrors { field message }
  }
}`;

/**
 * Create a menu, or replace the items of the one already on this handle.
 *
 * Shopify's default menus (`main-menu`) refuse a handle change, so the handle is
 * only sent on create — updating a default menu's items is allowed, renaming it
 * is not.
 */
export async function upsertMenu(
  handle: string,
  title: string,
  items: MenuItemInput[],
  existing: MenuNode | null,
): Promise<{id: string; created: boolean}> {
  if (existing) {
    const data = await shopifyAdminFetch<{
      menuUpdate: {menu: {id: string} | null; userErrors: UserError[]};
    }>(UPDATE, {id: existing.id, ...(existing.isDefault ? {} : {handle}), title, items});
    const {menu, userErrors} = data.menuUpdate;
    if (userErrors.length || !menu) throw new ShopifyUserError(`menuUpdate ${handle}`, userErrors);
    return {id: menu.id, created: false};
  }
  const data = await shopifyAdminFetch<{
    menuCreate: {menu: {id: string} | null; userErrors: UserError[]};
  }>(CREATE, {handle, title, items});
  const {menu, userErrors} = data.menuCreate;
  if (userErrors.length || !menu) throw new ShopifyUserError(`menuCreate ${handle}`, userErrors);
  return {id: menu.id, created: true};
}
