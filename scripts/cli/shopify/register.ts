import {Command} from "commander";

import {getAdminToken} from "./get-admin-token.ts";
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
    .option("--limit <n>", "process at most this many products")
    .option("--dry-run", "print what would be sent, without calling Shopify")
    .option("--delete", "delete products previously seeded from this directory")
    .option("--status <status>", "draft or active", "draft")
    .option("--stock <n>", "available inventory per variant", "5")
    .option("--with-photos [n]", "also upload photos; optional n limits how many")
    .action((opts) => (opts.delete ? deleteSeeded(opts) : seedProducts(opts)));
}
