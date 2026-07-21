import {Command} from "commander";

import {registerShopify} from "./shopify/register.ts";
import {cognitoDeleteAll} from "./aws/cognito-delete-all.ts";

const program = new Command();

program
  .name("ff")
  .description("Development utilities");

registerShopify(program);

const aws = program.command("aws");

aws
  .command("cognito-delete-all")
  .description("Delete up to four Cognito users")
  .action(async () => {
    await cognitoDeleteAll();
  });

program.parseAsync().catch((err: unknown) => {
  // Failures go to stderr only; stdout stays clean for piping.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
