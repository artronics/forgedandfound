import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {parse} from "yaml";

import {categories, spec} from "./spec.ts";
import {vocabulary} from "./vocabulary.ts";
import type {Conditions, SpecCollection, SpecMenu, SpecMenuItem} from "./types.ts";

// Loads spec/collections.yaml + spec/menu.yaml and validates them against the
// rest of the model. Validation runs at import time, so a bad spec fails before
// any Shopify call is made — the same contract as spec.ts.
//
// The checks here are not stylistic: each one corresponds to a way Shopify would
// otherwise fail late, silently, or destructively.

declare const __dirname: string | undefined;
const moduleDir =
  typeof __dirname !== "undefined" ? __dirname : dirname(new URL(import.meta.url).pathname);
const SPEC_DIR = join(moduleDir, "..", "spec");

function loadYaml<T>(file: string): T {
  return parse(readFileSync(join(SPEC_DIR, file), "utf8")) as T;
}

const collectionList = loadYaml<{collections: SpecCollection[]}>("collections.yaml").collections ?? [];
const menuList = loadYaml<{menus: SpecMenu[]}>("menu.yaml").menus ?? [];

export class CollectionsError extends Error {
  constructor(where: string, message: string) {
    super(`Invalid spec at ${where}: ${message}`);
    this.name = "CollectionsError";
  }
}

/** Shopify allows sub-items up to three levels deep. */
const MAX_MENU_DEPTH = 3;

/** Facets that are not metafields: they map to their own rule columns. */
const LITERAL_FACETS = new Set(["tag", "product_type"]);

const categoryIds = new Set(categories.map((c) => c.id));
const productMetafieldKeys = new Set(
  spec.metafields.filter((m) => m.owner === "PRODUCT").map((m) => m.key),
);
/** metafield key → the metaobject type its handles must exist in. */
const refTypeForKey = new Map(
  spec.metafields.filter((m) => m.owner === "PRODUCT" && m.ref).map((m) => [m.key, m.ref!]),
);
const handlesByType = new Map(
  Object.entries(vocabulary).map(([type, entries]) => [type, new Set(entries.map((e) => e.handle))]),
);

const asList = (value: string | string[]): string[] => (Array.isArray(value) ? value : [value]);

/**
 * Validate one facet → handle(s) pair. Shared by collection rule sets and menu
 * filter links: both name the same facets and resolve the same handles, so a
 * typo fails identically wherever it appears.
 */
function validateConditions(conds: Conditions, where: string, block?: "all" | "any"): void {
  for (const [facet, value] of Object.entries(conds)) {
    const values = asList(value);
    if (!values.length) throw new CollectionsError(where, `facet '${facet}' has no value`);

    // A list under `all` demands the product carry EVERY value, which no
    // single-valued facet can satisfy — a silently-empty collection.
    if (block === "all" && values.length > 1 && facet !== "tag") {
      throw new CollectionsError(
        where,
        `'${facet}' lists ${values.length} values inside \`all\`, which requires a product to carry all of them. ` +
          `Use \`any\` for OR, or a menu filter link if it also needs a category.`,
      );
    }

    if (facet === "category") {
      const unknown = values.filter((v) => !categoryIds.has(v));
      if (unknown.length) {
        throw new CollectionsError(where, `unknown category '${unknown.join(", ")}' (see categories.yaml)`);
      }
      continue;
    }
    if (LITERAL_FACETS.has(facet)) continue;

    if (!productMetafieldKeys.has(facet)) {
      throw new CollectionsError(
        where,
        `'${facet}' is not a PRODUCT metafield in metafields.yaml (nor category/tag/product_type)`,
      );
    }
    // Reference facets must name a real vocabulary entry, or the handle would
    // resolve to no GID at apply time and the rule would be dropped.
    const refType = refTypeForKey.get(facet);
    if (!refType) continue;
    const known = handlesByType.get(refType);
    if (!known) continue;
    const unknown = values.filter((v) => !known.has(v));
    if (unknown.length) {
      throw new CollectionsError(where, `unknown ${refType} handle '${unknown.join(", ")}'`);
    }
  }
}

function validateCollections(): void {
  const seen = new Set<string>();
  for (const c of collectionList) {
    const where = `collection '${c.id ?? "(no id)"}'`;
    if (!c.id) throw new CollectionsError(where, "missing id");
    if (!c.title) throw new CollectionsError(where, "missing title");
    if (seen.has(c.id)) throw new CollectionsError(where, "duplicate id");
    seen.add(c.id);

    const blocks = (["all", "any"] as const).filter((k) => c[k] !== undefined);
    if (blocks.length !== 1) {
      throw new CollectionsError(
        where,
        `must declare exactly one of \`all\`/\`any\` (found ${blocks.join(" + ") || "neither"}). ` +
          `Shopify has one AND/OR switch per collection, so mixed logic belongs in a menu filter link.`,
      );
    }
    const block = blocks[0];
    const conds = c[block]!;
    if (!Object.keys(conds).length) throw new CollectionsError(where, `\`${block}\` has no conditions`);
    validateConditions(conds, where, block);
  }
}

function validateMenus(collectionIds: Set<string>): void {
  const seenHandles = new Set<string>();

  const walk = (items: SpecMenuItem[], path: string, depth: number): void => {
    for (const item of items) {
      if (!item.title) throw new CollectionsError(path, "menu item is missing a title");
      const where = `${path} > ${item.title}`;
      if (depth > MAX_MENU_DEPTH) {
        throw new CollectionsError(where, `nested ${depth} levels deep; Shopify allows ${MAX_MENU_DEPTH}`);
      }
      if (item.collection && !collectionIds.has(item.collection)) {
        throw new CollectionsError(
          where,
          `links to '${item.collection}', which collections.yaml does not declare`,
        );
      }
      if (item.url && item.collection) {
        throw new CollectionsError(where, "declares both `url` and `collection` — it can only link to one");
      }
      if (item.filters) {
        // A filter link narrows a landing set; with nothing to land on there is
        // no set to narrow.
        if (!item.collection) throw new CollectionsError(where, "`filters` needs a landing `collection`");
        validateConditions(item.filters, where);
      }
      walk(item.items ?? [], where, depth + 1);
    }
  };

  for (const menu of menuList) {
    if (!menu.handle) throw new CollectionsError("menu", "missing handle");
    if (seenHandles.has(menu.handle)) throw new CollectionsError(`menu '${menu.handle}'`, "duplicate handle");
    seenHandles.add(menu.handle);
    if (!menu.title) throw new CollectionsError(`menu '${menu.handle}'`, "missing title");
    walk(menu.items ?? [], `menu '${menu.handle}'`, 1);
  }
}

validateCollections();
validateMenus(new Set(collectionList.map((c) => c.id)));

export const collections: readonly SpecCollection[] = collectionList;
export const menus: readonly SpecMenu[] = menuList;

/** Worth printing, not worth refusing to run over. */
export function collectionWarnings(): string[] {
  const out: string[] = [];
  for (const c of collectionList) {
    // `any` ORs everything together, so a category here widens rather than
    // scopes — the collection matches that category *or* the facet.
    if (c.any && "category" in c.any && Object.keys(c.any).length > 1) {
      out.push(
        `collection '${c.id}': 'category' inside \`any\` is OR-ed with the other conditions, ` +
          `so it widens the collection instead of scoping it`,
      );
    }
  }
  return out;
}
