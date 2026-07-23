import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {parse} from "yaml";

import {
  isReferenceType,
  type CategoryMapping,
  type Spec,
  type SpecField,
  type SpecMetafield,
  type SpecMetaobject,
} from "./types.ts";

// Loads the model from spec/*.yaml and validates it. The YAML is the source of
// truth (MODEL.md carries the reasoning, not the tables). Validation runs at
// import time so a malformed spec fails before any Shopify call is made.

// Works whether the loader is pulled in as ESM or CJS (tsx registers both).
declare const __dirname: string | undefined;
const moduleDir =
  typeof __dirname !== "undefined" ? __dirname : dirname(new URL(import.meta.url).pathname);
const SPEC_DIR = join(moduleDir, "..", "spec");

function loadYaml<T>(file: string): T {
  return parse(readFileSync(join(SPEC_DIR, file), "utf8")) as T;
}

const metaobjects = loadYaml<{metaobjects: SpecMetaobject[]}>("metaobjects.yaml").metaobjects ?? [];
const metafields = loadYaml<{metafields: SpecMetafield[]}>("metafields.yaml").metafields ?? [];
const categoryList = loadYaml<{categories: CategoryMapping[]}>("categories.yaml").categories ?? [];

/** `meta.description` is internal documentation, but there is no reason the person
 * entering data shouldn't see it — so it becomes the Shopify-facing `description`
 * unless an explicit `description` overrides it with merchant-facing wording. */
function applyMetaDescriptions(): void {
  const fill = (o: {description?: string; meta?: Record<string, unknown>}) => {
    const fromMeta = o.meta?.description;
    if (!o.description && typeof fromMeta === "string") o.description = fromMeta;
  };
  for (const mo of metaobjects) {
    fill(mo);
    for (const field of mo.fields ?? []) fill(field);
  }
  for (const mf of metafields) fill(mf);
}

class SpecError extends Error {
  constructor(where: string, message: string) {
    super(`Invalid spec at ${where}: ${message}`);
    this.name = "SpecError";
  }
}

/** A `ref` must name a metaobject declared *earlier* — the reconciler creates
 * definitions in file order, so a later target would not exist yet. */
function validateRef(ref: string | undefined, type: string, where: string, declared: Set<string>): void {
  if (isReferenceType(type)) {
    if (!ref) throw new SpecError(where, `type '${type}' requires a 'ref'`);
    if (!declared.has(ref)) {
      throw new SpecError(
        where,
        `ref '${ref}' is not a metaobject declared before this point in metaobjects.yaml`,
      );
    }
  } else if (ref) {
    throw new SpecError(where, `'ref' is only valid on reference types, not '${type}'`);
  }
}

function validateField(field: SpecField, where: string, declared: Set<string>): void {
  validateRef(field.ref, field.type, where, declared);
  if (field.choices && field.type !== "single_line_text_field") {
    throw new SpecError(where, `'choices' is only valid on single_line_text_field, not '${field.type}'`);
  }
}

function validate(): void {
  const declared = new Set<string>();

  for (const mo of metaobjects) {
    if (declared.has(mo.type)) throw new SpecError(`metaobject '${mo.type}'`, "duplicate type");
    const keys = new Set<string>();
    for (const field of mo.fields ?? []) {
      const where = `metaobject '${mo.type}' field '${field.key}'`;
      if (keys.has(field.key)) throw new SpecError(where, "duplicate field key");
      keys.add(field.key);
      // Not yet added to `declared`, so a metaobject cannot reference itself.
      validateField(field, where, declared);
    }
    declared.add(mo.type);
  }

  const seen = new Set<string>();
  for (const mf of metafields) {
    const where = `metafield '${mf.owner}/custom.${mf.key}'`;
    const id = `${mf.owner}:${mf.key}`;
    if (seen.has(id)) throw new SpecError(where, "duplicate owner+key");
    seen.add(id);
    validateRef(mf.ref, mf.type, where, declared);
  }

  const categoryIds = new Set<string>();
  for (const c of categoryList) {
    if (categoryIds.has(c.id)) throw new SpecError(`category '${c.id}'`, "duplicate id");
    categoryIds.add(c.id);
  }
}

applyMetaDescriptions();
validate();

export const spec: Spec = {metaobjects, metafields};

/** Metaobject types declared by the spec — the valid targets for any `ref`. */
export const metaobjectTypes: readonly string[] = metaobjects.map((m) => m.type);

/** Our category id → Shopify standard taxonomy mapping. */
export const categories: readonly CategoryMapping[] = categoryList;

export function getCategory(id: string): CategoryMapping | undefined {
  return categoryList.find((c) => c.id === id);
}
