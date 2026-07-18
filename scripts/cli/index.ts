#!/usr/bin/env node

import {Command} from "commander";

import {getAdminToken} from "./shopify/get-admin-token.js";
import {cognitoDeleteAll} from "./aws/cognito-delete-all";

const program = new Command();

program
  .name("ff")
  .description("Development utilities");

const shopify = program.command("shopify");

shopify
  .command("get-admin-token")
  .description("Print Shopify admin access token")
  .action(async () => {
    await getAdminToken();
  });

const aws = program.command("aws");

aws
  .command("cognito-delete-all")
  .description("Delete up to four Cognito users")
  .action(async () => {
    await cognitoDeleteAll();
  });

program.parseAsync();