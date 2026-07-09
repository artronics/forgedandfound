import fs from "node:fs/promises";
import path from "node:path";

import { render } from "@react-email/render";

import VerifyEmailTemplate  from "../emails/VerifyEmail";

async function main() {
  const html = await render(
    <VerifyEmailTemplate />
  );

  const output = path.resolve(
    process.cwd(),
    "dist",
    "verify-email.html"
  );

  await fs.mkdir(
    path.dirname(output),
    { recursive: true }
  );

  await fs.writeFile(output, html);

  console.log(`Written ${output}`);
}

const _ = main();