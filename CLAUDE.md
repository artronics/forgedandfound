# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

pnpm/turborepo monorepo for the Forged & Found jewellery e-commerce brand. Package manager is **pnpm** (root pins `pnpm@11.8.0`; some sub-packages pin `pnpm@10.33.0` — don't "fix" this mismatch, it's intentional per-package). Workspaces: `apps/*`, `services/*`, `packages/*`, `scripts`.

- `apps/web` — Next.js 16 storefront (the main product), talks to Shopify Storefront API + a custom Cognito/NextAuth login.
- `apps/shopify` — Shopify Admin embedded app (React Router / Shopify CLI template), manages custom checkout/admin-side extensions. Mostly stock Shopify template scaffolding — see its own `README.md` for template-specific gotchas.
- `packages/shopify-admin-client` — thin Shopify Admin GraphQL client (customer lookup/create) shared by the web app's server code and the Lambda services.
- `packages/secret-manager` — one-function wrapper around AWS Secrets Manager (`getSecret<T>(secretId)`).
- `packages/email` — React Email templates (verify/reset-password emails), rendered by `auth-email-hook-handler`.
- `services/auth-email-hook-handler` — Cognito **Custom Email Sender** Lambda. Decrypts the KMS-encrypted code Cognito gives it and sends the templated email via SES.
- `services/auth-shopify-customer-sync-handler` — Cognito **Post Confirmation** Lambda. Creates/links a Shopify customer for a newly-confirmed Cognito user and writes the Shopify customer id back onto the Cognito user as `custom:shopify_customer_id`.
- `services/user-service` — Lambda behind API Gateway (`api.<deployment-domain>`), applies users' own profile edits via Cognito admin calls (the web app runs on Vercel with no AWS credentials).
- `terraform/` — two root modules: `infra/` (per AWS account: Route53 zones, Cognito user pool + IdPs + trigger Lambdas, SES, ECR, Shopify event bus) and `platform/` (per deployment: Cognito app client, user-service + API Gateway, DNS records). Platform reads infra via `terraform_remote_state`. See `terraform/README.md`.
- `scripts/` — one-off operational scripts (Apple Sign-In JWT signing, an OAuth code-flow helper), run via `pnpm dlx ts-node`, not part of the build graph.
- `http/` — `.http` request collections (JetBrains HTTP Client) for manually poking the Shopify/auth APIs.


## Commands

Root (turbo-orchestrated, runs across all workspaces):
```
pnpm build          # turbo run build
pnpm lint           # turbo run lint
pnpm test           # turbo run test
pnpm dev            # turbo run dev (persistent, uncached)
pnpm build:web      # turbo run build --filter=@forgedandfound/web
```
`lint:apps` / `lint:other` run eslint directly (not through turbo) scoped to `apps` vs `packages`+`platform`.

Task orchestration also exists via **Task** (`Taskfile.yaml` at root, includes per-directory Taskfiles for `web`, `vercel:web`, `tf`, `services`, `scripts`). Root `.env.development`/`.env.local`/`.env.scripts`/`.env.terraform` are auto-loaded by Task for every task.

`apps/web` (run from `apps/web`, or via `task web:<name>` from root):
```
pnpm dev                          # next dev
pnpm build                        # next build (prebuild runs graphql-codegen automatically)
pnpm codegen                      # graphql-codegen --config codegen.ts
pnpm codegen:watch                # same, watch mode
pnpm lint                         # eslint
pnpm test                         # jest
pnpm test -- path/to/file.test.ts # single test file
```
Codegen hits the **live Shopify Storefront API** (needs `NEXT_PUBLIC_SHOPIFY_STORE_NAME` / `NEXT_PUBLIC_SHOPIFY_STOREFRONT_PUBLIC_TOKEN`) plus the local `graphql/schema.graphqls`, and writes to `graphql/generated/` — regenerate after changing any `.graphql` document under `app/`, `lib/`, or `graphql/`.

Vercel deploy (from repo root, `Taskfile.vercel.yaml`, must run from root not `apps/web`):
```
task vercel:build
task vercel:deploy:dev   # builds, deploys, then aliases to development.forgedandfound.co.uk
```

`apps/shopify` (Shopify CLI app):
```
pnpm dev              # shopify app dev (tunnels + hot reload)
pnpm build            # react-router build
pnpm typecheck         # react-router typegen && tsc --noEmit
pnpm deploy           # shopify app deploy (ships extensions/config to Shopify)
pnpm setup            # prisma generate && prisma migrate deploy
```

`services/*` Lambdas (from repo root via Task, `services/Taskfile.yaml`):
```
task services:build SERVICE=auth-email-hook-handler
task services:docker:build SERVICE=auth-email-hook-handler   # multi-arch buildx, no provenance
task services:docker:run SERVICE=auth-email-hook-handler     # runs on localhost:9000 (Lambda RIE)
```

Terraform (from repo root via Task, `terraform/Taskfile.yaml`; needs `TF_VAR_aws_account` = `nonprod`|`prod` from `.env.terraform`; AWS credentials are ambient via `AWS_PROFILE` — there is no `aws_profile` variable):
```
task tf:infra:init / tf:infra:plan / tf:infra:apply            # per-account singletons
task tf:platform:init DEPLOYMENT=<name>                        # then plan/apply/destroy likewise
```
Platform deployments are namespaced (`ff/platform/<account>/<name>`). `preview` is a real, permanent deployment (Vercel Preview points at it) — `task tf:platform:destroy` refuses it and always refuses prod. `development` is **not** a deployment, just a reserved DNS namespace owned by infra (alias any Vercel deployment onto `development.forgedandfound.co.uk`); platform rejects it as a deployment name.

## Architecture notes

**Auth flow spans three deployables.** `apps/web/auth.ts` (NextAuth v5) supports both a Cognito OIDC provider (social/hosted-UI login) and a Credentials provider (direct email/password against Cognito via `apps/web/lib/auth/cognito.ts`). Both paths converge on a Cognito user carrying `custom:shopify_customer_id` as a custom attribute — this is what links a Cognito identity to a Shopify customer record. That linkage is *created* by `services/auth-shopify-customer-sync-handler` (Cognito Post-Confirmation trigger) and *emailed* (verification / reset codes) by `services/auth-email-hook-handler` (Cognito Custom Email Sender trigger, which must decrypt the code via KMS before it can be templated into a URL). If you change the custom attribute name/shape, update all three.

**GraphQL is codegen'd, not hand-typed.** `apps/web/codegen.ts` reads from two schema sources — the live Shopify Storefront schema and the local `admin.schema.graphql`/`graphql/schema.graphqls` — into one generated client (`client` preset) under `graphql/generated/`. Query/mutation `.graphql` documents live next to the feature that uses them (`lib/<feature>/query.graphql`, `fragment.graphql`, `mutation.graphql`), not centralized — follow that convention when adding new Shopify queries.

**`apps/web/app` uses Next.js route groups**: `(store)` holds the customer-facing storefront (`home`, `shop/[handle]`, `collections/[handle]`, `search`, `account`, `pages/*` static legal pages); `app/api/auth/*` and `app/api/favourites/*` are route handlers outside the group. Feature logic (data fetching hooks, GraphQL documents, Zustand-style stores) lives in `lib/<feature>/`, not co-located with the route — e.g. cart state/logic is in `lib/cart/*`, not `app/(store)/.../cart`.

**Design system**: `apps/web/DESIGN.md` is the authoritative visual spec ("Modern Heirloom" editorial style — Emerald Green/Satin Linen palette, Noto Serif + Inter, no 1px borders, `rounded-sm` not pill buttons, tonal-layer elevation instead of shadows). Read it before making any styling/component decisions in `apps/web`; components are Shadcn/Radix-based under `components/ui/`.

**Env vars are read directly off `process.env`** with non-null assertions in a few central files (`apps/web/lib/env.ts`, `codegen.ts`, service `index.ts` files) rather than validated at a boundary — if you add a new required var, wire it into the relevant one of these rather than scattering `process.env.X!` around call sites.

