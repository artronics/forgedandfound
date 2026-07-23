import {Command} from "commander";

import {getAdminToken} from "./get-admin-token.ts";
import {modelApply, modelPlan, modelSeedEntries} from "./model.ts";
import {deleteSeeded, seedProducts} from "./seed/index.ts";

/** Wire up `ff shopify ...`. Commands live one-per-file under this directory and
 * are registered here (in-process), so they share the env/token/GraphQL client. */
export function registerShopify(program: Command): void {
  const shopify = program.command("shopify").description("Shopify admin utilities");

  shopify
    .command("get-admin-token")
    .description("Print Shopify admin access token")
    .action(getAdminToken);

  const seed = shopify.command("seed").description("Seed and tidy the dev store from scraped data");

  seed
    .command("products")
    .description("Create products in Shopify from a scraped data directory (or delete with --delete)")
    .requiredOption("-d, --dir <path>", "data directory (holds our products/… tree)")
    .option("--limit <n>", "at most this many products in total, spread across categories")
    .option("--per-category <n>", "at most this many products from each category")
    .option("-c, --category <id...>", "only these categories: ring, necklace, earring, bracelet")
    .option("-s, --site <name...>", "only products scraped from these sites")
    .option("--dry-run", "print what would be sent, without calling Shopify")
    .option("--delete", "delete products previously seeded from this directory")
    .option("--status <status>", "draft or active", "draft")
    .option("--stock <n>", "available inventory per variant", "5")
    .option("--with-photos [n]", "also upload photos; optional n limits how many")
    .action((opts) => (opts.delete ? deleteSeeded(opts) : seedProducts(opts)));

  const model = shopify
    .command("model")
    .description("Provision the metaobject/metafield data model (migration reconciler)");

  model
    .command("plan")
    .description("Dry-run: snapshot the store and print the change plan (no writes)")
    .requiredOption("--store <type>", "dev or live")
    .option("--prune", "include deletes of managed resources not in the spec")
    .option("--out <dir>", "migration-data base dir (or set MIGRATION_DATA_DIR)")
    .action(modelPlan);

  model
    .command("apply")
    .description("Apply the change plan to the store")
    .requiredOption("--store <type>", "dev or live")
    .option("--prune", "delete managed resources not in the spec (destructive)")
    .option("--allow-destructive", "permit destructive ops (delete/prune/recreate)")
    .option("--confirm-live", "required to apply to the live store")
    .option("--out <dir>", "migration-data base dir (or set MIGRATION_DATA_DIR)")
    .action(modelApply);

  model
    .command("seed-entries")
    .description("Populate metaobject entries (the controlled-vocabulary values)")
    .requiredOption("--store <type>", "dev or live")
    .option("--dry-run", "print intended upserts, without calling Shopify")
    .action(modelSeedEntries);
}
