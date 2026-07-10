import {VercelConfig} from "@vercel/config/v1";

// Vercel project config for the `web` app in the pnpm/turbo monorepo.
//
// REQUIRED dashboard setting (cannot be expressed here):
//   Project → Settings → Build & Deployment → Root Directory = `apps/web`
//   (leave "Include files outside the Root Directory" enabled — the default —
//   so Vercel can see the workspace root, lockfile, and turbo graph).
//
// With Root Directory = apps/web and Turborepo detected, Vercel runs the
// commands below from the monorepo root.
export const config: VercelConfig = {
  framework: 'nextjs',
  cleanUrls: true,
  trailingSlash: false,

  // Build only `web` and the workspace packages it depends on. turbo resolves
  // web's internal deps from the graph, so `--filter` never over- or
  // under-builds (today web has no internal deps; if it later imports
  // @forgedandfound/lib or /email, they get built first automatically).
  buildCommand: 'turbo run build --filter=@forgedandfound/web',

  // Skip the deployment entirely unless `web` OR one of its workspace
  // dependencies changed in the pushed commit range. This is the "only
  // consider the web directory and its dependencies" behaviour: turbo-ignore
  // diffs against the turbo graph and exits 0 (skip) when nothing relevant
  // changed, so a commit touching only apps/shopify or platform/** won't
  // trigger a web redeploy.
  ignoreCommand: 'npx turbo-ignore @forgedandfound/web',
};
