import {existsSync, readdirSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

import {shopifyAdminFetch} from "@forgedandfound/shopify-admin-client/client";
import {publicationIdByName, publishTo} from "@forgedandfound/shopify-admin-client/publications";
import {stores} from "@forgedandfound/model-shopify";

import {shopify} from "../../../env.ts";
import {info} from "../../log.ts";
import {lockPath, readLock, writeLock} from "./lock.ts";
import {
  bindProduct,
  loadCatalogue,
  resolveCategories,
  type BoundProduct,
  type ScrapedProduct,
} from "./model.ts";

// Shapes we read from a scraped product directory. `product.json` is our data
// model (facet handles + variants); `meta.json` carries the raw title/vendor/
// description and image URLs.
interface ProductJson extends ScrapedProduct {
  id: string;
  site: string;
  product_type: string;
  variants: {
    title?: string | null;
    options: string[];
    price: number | null;
    sku: string | null;
    barcode: string | null;
  }[];
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
  perCategory?: string;
  category?: string[];
  site?: string[];
  dryRun?: boolean;
  delete?: boolean;
  status?: string; // "draft" | "active"
  stock?: string; // available inventory per variant
  withPhotos?: boolean | string; // switch; optional value is a photo count
  publication?: string; // sales channel name; defaults to the store's configured one
  noPublish?: boolean; // create without publishing to any channel
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

const PRODUCT_MEDIA_COUNT = `
query MediaCount($id: ID!) {
  product(id: $id) { id mediaCount { count } }
}`;

const PRIMARY_LOCATION = `query { locations(first: 1) { nodes { id } } }`;

const PLACEHOLDER_LOCATION = "gid://shopify/Location/PRIMARY"; // stand-in for dry-run previews

/** The sales channel to publish to: an explicit `--publication`, else the one
 * configured for whichever store the env points at. */
function publicationName(explicit?: string): string {
  if (explicit) return explicit;
  const store = stores.find((s) => s.name === shopify.storeName);
  if (!store) {
    throw new Error(
      `No store configured for '${shopify.storeName}'. Pass --publication to name the sales channel.`,
    );
  }
  return store.publication;
}

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

interface Selection {
  categories?: string[];
  sites?: string[];
  perCategory?: number;
  limit?: number;
}

/** Walk the data dir (our `products/<category>/<design>/<id>/` convention) and
 * load each product.json alongside its meta.json, in stable order. */
function loadAll(dir: string): Item[] {
  return (readdirSync(dir, {recursive: true}) as string[])
    .filter((p) => p.endsWith("product.json"))
    .map((p) => join(dir, p))
    .sort()
    .map((file) => {
      const product = JSON.parse(readFileSync(file, "utf8")) as ProductJson;
      const metaPath = join(dirname(file), "meta.json");
      const meta = existsSync(metaPath) ? (JSON.parse(readFileSync(metaPath, "utf8")) as MetaJson) : {};
      return {key: `${product.site}:${product.id}`, product, meta};
    });
}

/** Pick what to seed. `--limit` is spread across categories rather than taken off
 * the top: the tree is sorted by path, so a flat slice of 8 would be 8 bracelets
 * and no rings. Taking one category at a time in turn means a small limit still
 * gives a look at each. */
function discover(dir: string, sel: Selection): Item[] {
  let items = loadAll(dir);
  if (sel.categories?.length) items = items.filter((i) => sel.categories!.includes(i.product.category));
  if (sel.sites?.length) items = items.filter((i) => sel.sites!.includes(i.product.site));

  const byCategory = new Map<string, Item[]>();
  for (const item of items) {
    const bucket = byCategory.get(item.product.category) ?? [];
    if (!sel.perCategory || bucket.length < sel.perCategory) bucket.push(item);
    byCategory.set(item.product.category, bucket);
  }

  const rounds = Math.max(0, ...[...byCategory.values()].map((b) => b.length));
  const spread: Item[] = [];
  for (let i = 0; i < rounds; i++) {
    for (const bucket of byCategory.values()) {
      if (bucket[i]) spread.push(bucket[i]);
      if (sel.limit && spread.length >= sel.limit) return spread;
    }
  }
  return spread;
}

// Shopify has no concept of a product without options: a single-variant product
// carries a placeholder "Title / Default Title" pair, and `productSet` rejects
// variants outright unless the options are declared. Nearly half our products
// vary in nothing at all, so they need it supplied.
const DEFAULT_OPTION = "Title";
const DEFAULT_OPTION_VALUE = "Default Title";

/** Build a Shopify ProductSetInput from the bound model (options, per-variant
 * finish/size bindings, metafields) plus the raw commercial fields.
 *
 * Returns any variants dropped along the way, for the caller to report. */
function buildInput(
  product: ProductJson,
  meta: MetaJson,
  bound: BoundProduct,
  opts: {status: string; stock: number; locationId: string; categoryGid: string | null},
): {input: Record<string, unknown>; dropped: string[]} {
  const varies = bound.options.length > 0;
  const productOptions = varies
    ? bound.options.map((o, i) => ({
        name: o.name,
        position: i + 1,
        values: o.values.map((v) => ({name: v})),
      }))
    : [{name: DEFAULT_OPTION, position: 1, values: [{name: DEFAULT_OPTION_VALUE}]}];

  // Shopify identifies a variant by its option values, so two variants can't
  // share a tuple. Source values sometimes collapse onto one of ours — Aurée
  // sells a ring as "9ct Three Colour Gold" and "18ct Three Colour Gold", both
  // of which our vocabulary only knows as gold — and the second would be
  // rejected. If the model says they're the same variant, they are: keep the
  // first and say which went.
  const dropped: string[] = [];
  const seen = new Set<string>();

  const variants = product.variants.flatMap((v, index) => {
    const {optionValues, finishGid, sizeGid} = bound.variants[index];
    const values = varies ? optionValues : [{optionName: DEFAULT_OPTION, name: DEFAULT_OPTION_VALUE}];
    const key = values.map((o) => `${o.optionName}=${o.name}`).join(" | ");
    if (seen.has(key)) {
      dropped.push(`variant '${v.title ?? key}' duplicates '${key}' once bound to the model`);
      return [];
    }
    seen.add(key);

    const metafields = [
      finishGid && {namespace: "custom", key: "finish", type: "metaobject_reference", value: finishGid},
      sizeGid && {namespace: "custom", key: "size", type: "metaobject_reference", value: sizeGid},
    ].filter(Boolean);

    return [
      {
        ...(v.price != null ? {price: String(v.price)} : {}),
        ...(v.sku ? {sku: v.sku} : {}),
        ...(v.barcode ? {barcode: v.barcode} : {}),
        optionValues: values,
        inventoryItem: {tracked: true},
        inventoryQuantities: [{locationId: opts.locationId, name: "available", quantity: opts.stock}],
        ...(metafields.length ? {metafields} : {}),
      },
    ];
  });

  return {
    input: {
      title: meta.title ?? product.id,
      ...(meta.description ? {descriptionHtml: meta.description} : {}),
      productType: product.product_type,
      ...(opts.categoryGid ? {category: opts.categoryGid} : {}),
      ...(meta.vendor ? {vendor: meta.vendor} : {}),
      status: opts.status,
      productOptions,
      variants,
      ...(bound.metafields.length ? {metafields: bound.metafields} : {}),
    },
    dropped,
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
  const status = normStatus(opts.status);
  const stock = opts.stock ? parseInt(opts.stock, 10) : 5;
  const photos = photoLimit(opts.withPhotos);
  const items = discover(dir, {
    categories: opts.category,
    sites: opts.site,
    perCategory: opts.perCategory ? parseInt(opts.perCategory, 10) : undefined,
    limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
  });
  const spread = [...new Set(items.map((i) => i.product.category))]
    .map((c) => `${c} ${items.filter((i) => i.product.category === c).length}`)
    .join(", ");
  info(`Selected ${items.length} product(s) under ${dir}${spread ? ` (${spread})` : ""}`);

  // Load the curated vocabularies once for the whole run (read-only), and verify
  // the pinned standard-taxonomy categories still resolve.
  info("Loading curated vocabularies …");
  const catalogue = await loadCatalogue();
  const categoryGids = await resolveCategories(items.map((i) => i.product.category));

  if (opts.dryRun) {
    for (const {key, product, meta} of items) {
      const bound = bindProduct(product, catalogue);
      const {input, dropped} = buildInput(product, meta, bound, {
        status,
        stock,
        locationId: PLACEHOLDER_LOCATION,
        categoryGid: categoryGids.get(product.category) ?? null,
      });
      info(`\n--- ${key} -> productSet (status=${status}, stock=${stock}) ---`);
      info(JSON.stringify(input, null, 2));
      for (const w of [...bound.warnings, ...dropped]) info(`  WARN ${w}`);
      if (photos !== undefined) {
        const srcs = photoSources(meta, photos);
        info(`  + ${srcs.length} photo(s): ${srcs.join(", ") || "(none)"}`);
      }
    }
    info(`\nDry run: ${items.length} product(s) would be created. No changes made.`);
    return;
  }

  const locationId = await primaryLocationId();
  // Resolved once, before anything is created: a wrong channel name should fail
  // the run up front rather than leave a half-published catalogue.
  const publicationId = opts.noPublish ? null : await publicationIdByName(publicationName(opts.publication));
  if (publicationId) info(`publishing to '${publicationName(opts.publication)}'`);

  const lock = readLock(dir, shopify.shopDomain);
  let created = 0;
  let skipped = 0;

  for (const {key, product, meta} of items) {
    if (lock.products[key]) {
      info(`skip ${key} (already seeded as ${lock.products[key].id})`);
      skipped++;
      continue;
    }

    const bound = bindProduct(product, catalogue);
    const {input, dropped} = buildInput(product, meta, bound, {
      status,
      stock,
      locationId,
      categoryGid: categoryGids.get(product.category) ?? null,
    });
    for (const w of [...bound.warnings, ...dropped]) info(`  WARN ${key}: ${w}`);

    const data = await shopifyAdminFetch<ProductSetResult>(PRODUCT_SET, {input});
    if (data.productSet.userErrors.length || !data.productSet.product) {
      throw new Error(`productSet failed for ${key}: ${JSON.stringify(data.productSet.userErrors)}`);
    }
    const p = data.productSet.product;
    if (publicationId) await publishTo(p.id, publicationId);
    if (photos !== undefined) {
      await uploadPhotos(p.id, photoSources(meta, photos), p.title);
    }
    lock.products[key] = {id: p.id, handle: p.handle, title: p.title};
    writeLock(dir, lock); // write after each so a mid-run crash stays idempotent
    console.log(p.id); // stdout: the created product gid, one per line
    const linked = bound.variants.filter((v) => v.finishGid).length;
    info(
      `created ${key} -> ${p.id} [${bound.metafields.length} metafield(s), ` +
        `${linked}/${bound.variants.length} variant(s) linked to a finish` +
        `${publicationId ? ", published" : ""}]`,
    );
    created++;
  }
  info(`Done. created=${created} skipped=${skipped}`);
}

/**
 * Publish products that are already in the store to the sales channel.
 *
 * Seeding used to create products without publishing them, which leaves a
 * catalogue that looks complete in the admin but is invisible to the Storefront
 * API. This repairs those in place — re-seeding would not, since the lock makes
 * it skip everything it has already created.
 */
export async function publishSeeded(opts: SeedOpts): Promise<void> {
  const dir = resolve(opts.dir);
  const lock = readLock(dir, shopify.shopDomain);
  const keys = Object.keys(lock.products);
  const name = publicationName(opts.publication);
  info(`${keys.length} seeded product(s) in ${lockPath(dir)} -> '${name}'`);
  if (lock.shop !== shopify.shopDomain) {
    info(`WARNING: lock is for ${lock.shop}, current store is ${shopify.shopDomain}`);
  }

  if (opts.dryRun) {
    info(`\nDry run: ${keys.length} product(s) would be published to '${name}'. No changes made.`);
    return;
  }

  const publicationId = await publicationIdByName(name);
  let published = 0;
  for (const key of keys) {
    const {id} = lock.products[key];
    try {
      await publishTo(id, publicationId); // idempotent: already-published is a no-op
      published++;
    } catch (e) {
      info(`WARN publish ${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(String(published)); // stdout: how many are on the channel
  info(`Done. published=${published}/${keys.length}`);
}

/**
 * Upload photos to products that are already in the store.
 *
 * Seeding without `--with-photos` leaves an imageless catalogue, and re-seeding
 * cannot repair it — the lock makes it skip everything it has already created.
 * This walks the lock instead, pairing each product with its scraped meta.json,
 * and skips any product that already has media (so it is safe to re-run).
 */
export async function photosSeeded(opts: SeedOpts): Promise<void> {
  const dir = resolve(opts.dir);
  const photos = photoLimit(opts.withPhotos) ?? Infinity;
  const lock = readLock(dir, shopify.shopDomain);
  const keys = Object.keys(lock.products);
  info(`${keys.length} seeded product(s) in ${lockPath(dir)}`);
  if (lock.shop !== shopify.shopDomain) {
    info(`WARNING: lock is for ${lock.shop}, current store is ${shopify.shopDomain}`);
  }

  const metaByKey = new Map(loadAll(dir).map((i) => [i.key, i.meta]));

  let uploaded = 0;
  let skipped = 0;
  for (const key of keys) {
    const {id, title} = lock.products[key];
    const srcs = photoSources(metaByKey.get(key) ?? {}, photos);
    if (!srcs.length) {
      info(`skip ${key} (no scraped images)`);
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      info(`would upload ${srcs.length} photo(s) to ${key}`);
      continue;
    }

    // Already has media -> already repaired (or seeded --with-photos): re-running
    // must not duplicate the gallery.
    const data = await shopifyAdminFetch<{product: {mediaCount: {count: number}} | null}>(
      PRODUCT_MEDIA_COUNT,
      {id},
    );
    if (!data.product) {
      info(`WARN ${key}: ${id} no longer exists`);
      skipped++;
      continue;
    }
    if (data.product.mediaCount.count > 0) {
      info(`skip ${key} (already has ${data.product.mediaCount.count} media)`);
      skipped++;
      continue;
    }

    await uploadPhotos(id, srcs, title);
    console.log(id); // stdout: the product gid, one per line
    info(`uploaded ${srcs.length} photo(s) to ${key}`);
    uploaded++;
  }
  info(opts.dryRun ? "Dry run: no changes made." : `Done. uploaded=${uploaded} skipped=${skipped}`);
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
