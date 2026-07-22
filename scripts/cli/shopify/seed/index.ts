import {existsSync, readdirSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

import {shopifyAdminFetch} from "@forgedandfound/shopify-admin-client/client";

import {shopify} from "../../../env.ts";
import {info} from "../../log.ts";
import {lockPath, readLock, writeLock} from "./lock.ts";
import {
  buildProductMetafields,
  ensureFinish,
  finishHandleFor,
  loadHandleMaps,
  type MetafieldInput,
  type ProductModel,
} from "./model.ts";

// Shapes we read from a scraped product directory. `product.json` is our data
// model (facet handles + variants); `meta.json` carries the raw title/vendor/
// description and image URLs.
interface ProductJson extends ProductModel {
  id: string;
  site: string;
  product_type: string;
  options: {name: string; position: number; values: string[]}[];
  variants: {options: string[]; price: number | null; sku: string | null; barcode: string | null}[];
}
interface MetaJson {
  title?: string;
  vendor?: string | null;
  description?: string;
  images?: {file: string; src: string}[];
}
interface Item {
  key: string; // stable id for the lock: "<site>:<handle>"
  product: ProductJson;
  meta: MetaJson;
}

interface SeedOpts {
  dir: string;
  limit?: string;
  dryRun?: boolean;
  delete?: boolean;
  status?: string; // "draft" | "active"
  stock?: string; // available inventory per variant
  withPhotos?: boolean | string; // switch; optional value is a photo count
}

const PRODUCT_SET = `
mutation SeedProduct($input: ProductSetInput!) {
  productSet(synchronous: true, input: $input) {
    product { id title handle }
    userErrors { field message }
  }
}`;

const PRODUCT_CREATE_MEDIA = `
mutation AddMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media { id status }
    mediaUserErrors { field message }
  }
}`;

const PRODUCT_DELETE = `
mutation DeleteProduct($input: ProductDeleteInput!) {
  productDelete(input: $input) { deletedProductId userErrors { field message } }
}`;

const PRIMARY_LOCATION = `query { locations(first: 1) { nodes { id } } }`;

const PLACEHOLDER_LOCATION = "gid://shopify/Location/PRIMARY"; // stand-in for dry-run previews

function normStatus(status?: string): "DRAFT" | "ACTIVE" {
  const value = (status ?? "draft").toUpperCase();
  if (value !== "DRAFT" && value !== "ACTIVE") throw new Error("--status must be draft or active");
  return value;
}

/** `--with-photos` off -> undefined; bare -> Infinity (all); with number -> that limit. */
function photoLimit(withPhotos?: boolean | string): number | undefined {
  if (withPhotos === undefined || withPhotos === false) return undefined;
  if (withPhotos === true) return Infinity;
  const n = parseInt(withPhotos, 10);
  return Number.isNaN(n) ? Infinity : n;
}

function photoSources(meta: MetaJson, limit: number): string[] {
  const srcs = (meta.images ?? [])
    .map((i) => i.src)
    .filter(Boolean)
    .map((s) => (s.startsWith("//") ? `https:${s}` : s));
  return Number.isFinite(limit) ? srcs.slice(0, limit) : srcs;
}

/** Walk the data dir (our `products/<category>/<design>/<id>/` convention) and
 * load each product.json alongside its meta.json, in stable order. */
function discover(dir: string, limit?: number): Item[] {
  const files = (readdirSync(dir, {recursive: true}) as string[])
    .filter((p) => p.endsWith("product.json"))
    .map((p) => join(dir, p))
    .sort();

  const items: Item[] = [];
  for (const file of files) {
    const product = JSON.parse(readFileSync(file, "utf8")) as ProductJson;
    const metaPath = join(dirname(file), "meta.json");
    const meta = existsSync(metaPath) ? (JSON.parse(readFileSync(metaPath, "utf8")) as MetaJson) : {};
    items.push({key: `${product.site}:${product.id}`, product, meta});
    if (limit && items.length >= limit) break;
  }
  return items;
}

/** Build a Shopify ProductSetInput (product + options + variants + model metafields). */
function buildInput(
  product: ProductJson,
  meta: MetaJson,
  opts: {status: string; stock: number; locationId: string; metafields: MetafieldInput[]; finishGid: string | null},
): Record<string, unknown> {
  const productOptions = product.options.map((o) => ({
    name: o.name,
    position: o.position,
    values: o.values.map((v) => ({name: v})),
  }));

  // Every variant carries the product's composite finish (finish is constant per
  // scraped product; colour/purity live on the finish metaobject, not as axes).
  const variantMetafields = opts.finishGid
    ? [{namespace: "custom", key: "finish", type: "metaobject_reference", value: opts.finishGid}]
    : [];

  const variants = product.variants.map((v) => ({
    ...(v.price != null ? {price: String(v.price)} : {}),
    ...(v.sku ? {sku: v.sku} : {}),
    ...(v.barcode ? {barcode: v.barcode} : {}),
    // Pair each variant option value with its option name, in option order.
    optionValues: product.options
      .map((o, i) => ({optionName: o.name, name: v.options[i]}))
      .filter((ov) => ov.name != null),
    inventoryItem: {tracked: true},
    inventoryQuantities: [{locationId: opts.locationId, name: "available", quantity: opts.stock}],
    ...(variantMetafields.length ? {metafields: variantMetafields} : {}),
  }));

  return {
    title: meta.title ?? product.id,
    ...(meta.description ? {descriptionHtml: meta.description} : {}),
    productType: product.product_type,
    ...(meta.vendor ? {vendor: meta.vendor} : {}),
    status: opts.status,
    ...(productOptions.length ? {productOptions} : {}),
    variants,
    ...(opts.metafields.length ? {metafields: opts.metafields} : {}),
  };
}

type ProductSetResult = {
  productSet: {product: {id: string; title: string; handle: string} | null; userErrors: {message: string}[]};
};
type MediaResult = {productCreateMedia: {mediaUserErrors: {message: string}[]}};
type DeleteResult = {productDelete: {deletedProductId: string | null; userErrors: {message: string}[]}};

async function primaryLocationId(): Promise<string> {
  const data = await shopifyAdminFetch<{locations: {nodes: {id: string}[]}}>(PRIMARY_LOCATION);
  const id = data.locations.nodes[0]?.id;
  if (!id) throw new Error("No Shopify location found (needed to set inventory)");
  return id;
}

async function uploadPhotos(productId: string, sources: string[], alt: string): Promise<void> {
  if (!sources.length) return;
  const media = sources.map((originalSource) => ({originalSource, mediaContentType: "IMAGE", alt}));
  const data = await shopifyAdminFetch<MediaResult>(PRODUCT_CREATE_MEDIA, {productId, media});
  if (data.productCreateMedia.mediaUserErrors.length) {
    info(`  WARN media: ${JSON.stringify(data.productCreateMedia.mediaUserErrors)}`);
  }
}

export async function seedProducts(opts: SeedOpts): Promise<void> {
  const dir = resolve(opts.dir);
  const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
  const status = normStatus(opts.status);
  const stock = opts.stock ? parseInt(opts.stock, 10) : 5;
  const photos = photoLimit(opts.withPhotos);
  const items = discover(dir, limit);
  info(`Found ${items.length} product(s) under ${dir}${limit ? ` (limit ${limit})` : ""}`);

  // Resolve model facet handles → metaobject GIDs once for the whole run (read-only).
  info("Loading metaobject handle maps …");
  const maps = await loadHandleMaps();

  if (opts.dryRun) {
    for (const {key, product, meta} of items) {
      const {metafields, unresolved} = buildProductMetafields(product, maps);
      info(`\n--- ${key} -> productSet (status=${status}, stock=${stock}) ---`);
      info(JSON.stringify(buildInput(product, meta, {status, stock, locationId: PLACEHOLDER_LOCATION, metafields, finishGid: null}), null, 2));
      info(`  finish: ${finishHandleFor(product) ?? "(none)"}`);
      if (unresolved.length) info(`  WARN unresolved metaobject handles: ${unresolved.join(", ")}`);
      if (photos !== undefined) {
        const srcs = photoSources(meta, photos);
        info(`  + ${srcs.length} photo(s): ${srcs.join(", ") || "(none)"}`);
      }
    }
    info(`\nDry run: ${items.length} product(s) would be created. No changes made.`);
    return;
  }

  const locationId = await primaryLocationId();
  const lock = readLock(dir, shopify.shopDomain);
  let created = 0;
  let skipped = 0;

  for (const {key, product, meta} of items) {
    if (lock.products[key]) {
      info(`skip ${key} (already seeded as ${lock.products[key].id})`);
      skipped++;
      continue;
    }
    const {metafields, unresolved} = buildProductMetafields(product, maps);
    if (unresolved.length) info(`  WARN ${key}: unresolved metaobject handles: ${unresolved.join(", ")}`);
    const finishGid = await ensureFinish(product, maps); // idempotent upsert of the composite finish
    const data = await shopifyAdminFetch<ProductSetResult>(PRODUCT_SET, {
      input: buildInput(product, meta, {status, stock, locationId, metafields, finishGid}),
    });
    if (data.productSet.userErrors.length || !data.productSet.product) {
      throw new Error(`productSet failed for ${key}: ${JSON.stringify(data.productSet.userErrors)}`);
    }
    const p = data.productSet.product;
    if (photos !== undefined) {
      await uploadPhotos(p.id, photoSources(meta, photos), p.title);
    }
    lock.products[key] = {id: p.id, handle: p.handle, title: p.title};
    writeLock(dir, lock); // write after each so a mid-run crash stays idempotent
    console.log(p.id); // stdout: the created product gid, one per line
    info(`created ${key} -> ${p.id} [${metafields.length} metafield(s)${finishGid ? " + finish" : ""}]`);
    created++;
  }
  info(`Done. created=${created} skipped=${skipped}`);
}

export async function deleteSeeded(opts: SeedOpts): Promise<void> {
  const dir = resolve(opts.dir);
  const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;
  const lock = readLock(dir, shopify.shopDomain);
  // Deleting a product removes its media too, so --with-photos needs no handling here.
  const keys = Object.keys(lock.products).slice(0, limit);
  info(`${keys.length} seeded product(s) to delete from ${lockPath(dir)}`);
  if (lock.shop !== shopify.shopDomain) {
    info(`WARNING: lock is for ${lock.shop}, current store is ${shopify.shopDomain}`);
  }

  if (opts.dryRun) {
    for (const key of keys) info(`would delete ${key} -> ${lock.products[key].id}`);
    info(`\nDry run: ${keys.length} product(s) would be deleted. No changes made.`);
    return;
  }

  for (const key of keys) {
    const {id} = lock.products[key];
    const data = await shopifyAdminFetch<DeleteResult>(PRODUCT_DELETE, {input: {id}});
    if (data.productDelete.userErrors.length) {
      info(`WARN delete ${key}: ${JSON.stringify(data.productDelete.userErrors)}`);
      continue;
    }
    delete lock.products[key];
    writeLock(dir, lock);
    console.log(id); // stdout: the deleted product gid
    info(`deleted ${key} -> ${id}`);
  }
  info("Done.");
}
