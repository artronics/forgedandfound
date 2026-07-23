import {
  enableSmartCollectionCondition,
  listCollections,
  listDefinitionsWithCapabilities,
  upsertSmartCollection,
  type CollectionRule,
} from "@forgedandfound/shopify-admin-client/collections";
import {listMenus, upsertMenu, type MenuItemInput} from "@forgedandfound/shopify-admin-client/menus";
import {listMetaobjects} from "@forgedandfound/shopify-admin-client/metaobjects";
import {publicationIdByName, publishTo} from "@forgedandfound/shopify-admin-client/publications";

import {collections, collectionWarnings, menus} from "./collections.ts";
import {getCategory, spec} from "./spec.ts";
import type {Conditions, SpecMenuItem} from "./types.ts";

// Applies spec/collections.yaml + spec/menu.yaml to a store.
//
// The spec names things by handle because handles are ours and stable; Shopify
// needs GIDs, which differ per store. So every run resolves handles → GIDs
// first, and a handle that does not resolve aborts the run *before* anything is
// written — a rule silently dropped would produce a collection that looks fine
// and matches the wrong products.

export interface ApplyCollectionsOptions {
  /** false = dry-run: resolve and plan, call no mutations. */
  apply: boolean;
  /** Publish created collections to this sales channel. */
  publication?: string;
  log?: (msg: string) => void;
}

export interface CollectionChange {
  resource: string;
  status: "created" | "updated" | "planned" | "failed";
  error?: string;
}

export interface ApplyCollectionsResult {
  changes: CollectionChange[];
  failed: boolean;
}

/** Facets that map to their own rule column rather than a metafield. */
const COLUMN_FOR_LITERAL: Record<string, CollectionRule["column"]> = {
  tag: "TAG",
  product_type: "TYPE",
};

const asList = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

interface Resolved {
  /** metafield key → definition GID (a rule's conditionObjectId). */
  definitionIds: Map<string, string>;
  /** metaobject type → (handle → entry GID). */
  entryIds: Map<string, Map<string, string>>;
}

/** Which metaobject type each product metafield points at. */
const refTypeForKey = new Map(
  spec.metafields.filter((m) => m.owner === "PRODUCT" && m.ref).map((m) => [m.key, m.ref!]),
);

/** Every facet named anywhere in either spec — so we fetch only what is used. */
function facetsInUse(): Set<string> {
  const facets = new Set<string>();
  const add = (conds?: Conditions) => Object.keys(conds ?? {}).forEach((f) => facets.add(f));
  for (const c of collections) add(c.all ?? c.any);
  const walk = (items: SpecMenuItem[]) => {
    for (const item of items) {
      add(item.filters);
      walk(item.items ?? []);
    }
  };
  for (const menu of menus) walk(menu.items);
  return facets;
}

async function resolve(log: (m: string) => void): Promise<Resolved> {
  const facets = facetsInUse();
  const definitionIds = new Map<string, string>();
  const entryIds = new Map<string, Map<string, string>>();

  const defs = await listDefinitionsWithCapabilities("PRODUCT", "custom");
  for (const d of defs) definitionIds.set(d.key, d.id);

  // A metafield can only appear in a collection rule once its definition has the
  // smartCollectionCondition capability — without it the rule is rejected. This
  // is the step that makes our custom facets visible to the rule builder at all.
  for (const facet of facets) {
    if (facet === "category" || facet in COLUMN_FOR_LITERAL) continue;
    const def = defs.find((d) => d.key === facet);
    if (!def) throw new Error(`No custom.${facet} metafield definition on this store — run \`model apply\` first`);
    if (!def.smartCollectionCondition.enabled) {
      if (!def.smartCollectionCondition.eligible) {
        throw new Error(`custom.${facet} cannot be used as a collection condition (not eligible)`);
      }
      log(`  enabling smart-collection condition on custom.${facet}`);
      await enableSmartCollectionCondition("PRODUCT", "custom", facet);
    }
  }

  const types = new Set(
    [...facets].map((f) => refTypeForKey.get(f)).filter((t): t is string => Boolean(t)),
  );
  for (const type of types) {
    const entries = await listMetaobjects(type);
    entryIds.set(type, new Map(entries.map((e) => [e.handle, e.id])));
  }
  return {definitionIds, entryIds};
}

/** One facet condition → Shopify collection rules. */
function rulesFor(facet: string, value: string | string[], where: string, r: Resolved): CollectionRule[] {
  const values = asList(value);

  if (facet === "category") {
    return values.map((v) => {
      const category = getCategory(v);
      if (!category) throw new Error(`${where}: unknown category '${v}'`);
      return {column: "PRODUCT_CATEGORY_ID", relation: "EQUALS", condition: category.taxonomy_id};
    });
  }

  const literal = COLUMN_FOR_LITERAL[facet];
  if (literal) return values.map((v) => ({column: literal, relation: "EQUALS", condition: v}));

  const definitionId = r.definitionIds.get(facet);
  if (!definitionId) throw new Error(`${where}: no custom.${facet} definition on this store`);
  const refType = refTypeForKey.get(facet);

  return values.map((v) => {
    // A plain-text facet (purity) carries its value directly; a reference facet
    // must resolve to the entry's GID on *this* store.
    if (!refType) {
      return {column: "PRODUCT_METAFIELD_DEFINITION", relation: "EQUALS", condition: v, conditionObjectId: definitionId};
    }
    const gid = r.entryIds.get(refType)?.get(v);
    if (!gid) throw new Error(`${where}: '${v}' is not a seeded ${refType} entry — run \`model seed-entries\` first`);
    return {column: "PRODUCT_METAFIELD_DEFINITION", relation: "EQUALS", condition: gid, conditionObjectId: definitionId};
  });
}

/** Facet conditions → the query string a filter link carries. Values stay as
 * handles (GIDs differ per store); the storefront resolves them. */
function filterQuery(filters: Conditions): string {
  const params = Object.entries(filters).map(
    ([facet, value]) => `${encodeURIComponent(facet)}=${asList(value).map(encodeURIComponent).join(",")}`,
  );
  return params.length ? `?${params.join("&")}` : "";
}

/** A spec menu item → Shopify's item input. The link type is inferred from which
 * keys are present, matching how the spec reads. */
function menuItemInput(item: SpecMenuItem, handleFor: Map<string, string>, idFor: Map<string, string>): MenuItemInput {
  const items = (item.items ?? []).map((child) => menuItemInput(child, handleFor, idFor));

  if (item.collection && item.filters) {
    const handle = handleFor.get(item.collection)!;
    return {title: item.title, type: "HTTP", url: `/collections/${handle}${filterQuery(item.filters)}`, items};
  }
  if (item.collection) {
    return {title: item.title, type: "COLLECTION", resourceId: idFor.get(item.collection)!, items};
  }
  if (item.url) return {title: item.title, type: "HTTP", url: item.url, items};
  // A heading: Shopify has no such type, so `#` is the convention its own nav
  // editor uses for an item that only groups children.
  return {title: item.title, type: "HTTP", url: "#", items};
}

export async function applyCollections(opts: ApplyCollectionsOptions): Promise<ApplyCollectionsResult> {
  const log = opts.log ?? (() => {});
  const changes: CollectionChange[] = [];

  for (const w of collectionWarnings()) log(`WARN ${w}`);

  log("Resolving handles against the store …");
  const resolved = await resolve(log);

  // Build every rule set before writing anything: an unresolvable handle should
  // abort the whole run, not leave half the collections applied.
  const planned = collections.map((c) => {
    const where = `collection '${c.id}'`;
    const disjunctive = c.any !== undefined;
    const conds = (c.all ?? c.any)!;
    const rules = Object.entries(conds).flatMap(([facet, value]) => rulesFor(facet, value, where, resolved));
    return {spec: c, disjunctive, rules};
  });

  if (!opts.apply) {
    for (const p of planned) {
      log(`  plan  collection:${p.spec.id} (${p.disjunctive ? "any" : "all"}, ${p.rules.length} rule(s))`);
      changes.push({resource: `collection:${p.spec.id}`, status: "planned"});
    }
    for (const m of menus) {
      log(`  plan  menu:${m.handle} (${m.items.length} top-level item(s))`);
      changes.push({resource: `menu:${m.handle}`, status: "planned"});
    }
    return {changes, failed: false};
  }

  const existing = new Map((await listCollections()).map((c) => [c.handle, c]));
  const publicationId = opts.publication ? await publicationIdByName(opts.publication) : null;
  const idFor = new Map<string, string>();
  const handleFor = new Map<string, string>();

  for (const p of planned) {
    const resource = `collection:${p.spec.id}`;
    try {
      const {id, created} = await upsertSmartCollection(
        {
          handle: p.spec.id,
          title: p.spec.title,
          ...(p.spec.description ? {descriptionHtml: p.spec.description} : {}),
          appliedDisjunctively: p.disjunctive,
          rules: p.rules,
        },
        existing.get(p.spec.id)?.id ?? null,
      );
      // Unpublished collections are invisible to the Storefront API, exactly as
      // unpublished products are.
      if (publicationId) await publishTo(id, publicationId);
      idFor.set(p.spec.id, id);
      handleFor.set(p.spec.id, p.spec.id);
      log(`  ${created ? "created" : "updated"} ${resource}`);
      changes.push({resource, status: created ? "created" : "updated"});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log(`  FAIL  ${resource} — ${error}`);
      changes.push({resource, status: "failed", error});
      return {changes, failed: true}; // stop on first failure, like the reconciler
    }
  }

  const existingMenus = new Map((await listMenus()).map((m) => [m.handle, m]));
  for (const menu of menus) {
    const resource = `menu:${menu.handle}`;
    try {
      const items = menu.items.map((item) => menuItemInput(item, handleFor, idFor));
      const {created} = await upsertMenu(menu.handle, menu.title, items, existingMenus.get(menu.handle) ?? null);
      log(`  ${created ? "created" : "updated"} ${resource}`);
      changes.push({resource, status: created ? "created" : "updated"});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      log(`  FAIL  ${resource} — ${error}`);
      changes.push({resource, status: "failed", error});
      return {changes, failed: true};
    }
  }

  return {changes, failed: false};
}
