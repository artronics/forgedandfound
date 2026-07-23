// Public API of the Shopify model + migration library. The `ff` CLI is the only
// current consumer; keep this surface small and stable.

export {reconcile} from "./src/reconcile.ts";
export type {ReconcileOptions, ReconcileResult} from "./src/reconcile.ts";

export {snapshot} from "./src/snapshot.ts";
export type {CurrentState} from "./src/snapshot.ts";

export {diff} from "./src/diff.ts";
export type {DiffOptions} from "./src/diff.ts";

export {apply} from "./src/apply.ts";
export type {ApplyOptions} from "./src/apply.ts";

export {seedEntries} from "./src/seed-entries.ts";
export type {SeedEntriesOptions, SeedEntriesResult, EntryChange} from "./src/seed-entries.ts";

export {applyCollections} from "./src/apply-collections.ts";
export type {
  ApplyCollectionsOptions,
  ApplyCollectionsResult,
  CollectionChange,
} from "./src/apply-collections.ts";

export {collections, menus, collectionWarnings, CollectionsError} from "./src/collections.ts";

export {vocabulary} from "./src/vocabulary.ts";
export type {Vocabulary, VocabEntry} from "./src/vocabulary.ts";

export {spec, metaobjectTypes, categories, getCategory} from "./src/spec.ts";

export {stores, getStore} from "./src/config.ts";
export type {StoreType, StoreConfig} from "./src/config.ts";

export * from "./src/types.ts";
