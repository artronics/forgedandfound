# Forged & Found — Terraform Stacks

This directory is a **first-iteration** rebuild of `../infra` using
[Terraform Stacks](https://developer.hashicorp.com/terraform/language/stacks).
It is intentionally partial: it demonstrates the structure and a few
representative resources rather than migrating everything. See the
`TODO(iteration-2)` markers for what was deliberately left out.

## Why Stacks / do I need HashiCorp?

**Yes — Stacks require HCP Terraform.** There is no local-only Stacks mode;
plan/apply run on HCP Terraform, which also stores state automatically. So:

- Your HashiCorp account **is** used. No S3 backend, no state buckets/keys.
- Auth to AWS is via **OIDC** — each deployment mints a short-lived JWT that is
  exchanged for a role in the target account. No long-lived AWS keys in HCP.
- (If we had chosen *not* to use Stacks, the fallback would be classic root
  modules + one S3 state bucket per account with a `key` per environment. We
  went with Stacks as requested.)

## The big picture

Two categories of resource, mapped to **two Stacks**:

| Stack       | Category | Scope           | Lives once per… | Example resources                                 |
|-------------|----------|-----------------|-----------------|---------------------------------------------------|
| `infra/`    | infra    | per AWS account | account         | DNS zone records, Cognito user pool, SES identity |
| `platform/` | platform | per environment | environment     | Cognito **app client**, Shopify event bus + SQS   |

A **Stack** = the reusable definition (`*.tfcomponent.hcl`).
A **deployment** = one concrete instance of it, with its own isolated state
(`*.tfdeploy.hcl`).

```
                 infra Stack                         platform Stack
        ┌──────────────────────────┐        ┌────────────────────────────────┐
deploy: │ nonprod        prod       │        │ development  preview            │  (nonprod acct)
        │                           │        │ staging      production         │  (prod acct)
        │ user pool, SES, DNS       │        │ app client, shopify events      │
        └────────────┬─────────────┘        └───────────────┬────────────────┘
                     │ publish_output                        │ upstream_input
                     └──────────  cognito_user_pool_id  ─────┘
```

- **infra** has 2 deployments: `nonprod`, `prod`.
- **platform** has 4 deployments: `development` + `preview` (in nonprod),
  `staging` + `production` (in prod).
- platform consumes infra's outputs via `upstream_input` (linked Stacks), so
  each environment's Cognito client is created inside its account's shared pool.

### Difference from the old `../infra`

In the old layout *everything* was keyed to `deployment_env` — even the user
pool and DNS zone, which are really account-wide. Here that split is explicit:
account-wide things moved to the `infra` Stack, per-env things to `platform`.

## Naming / prefixes

Every resource is prefixed to avoid collisions (multiple environments share one
account):

- infra:    `ff-infra-<account>`      → `ff-infra-nonprod-user-pool`
- platform: `ff-<namespace>`          → `ff-development-shopify-product-events`

`namespace` normally equals the environment name. **This is the hook for
ephemeral per-user environments** (out of scope for now): set
`namespace = "pr-123"` or `"dev-alice"` and you get a fully isolated
`ff-pr-123-*` set of resources you can create and destroy independently. The
plumbing already supports it — see the commented block at the bottom of
`platform/deployments.tfdeploy.hcl`.

## Layout

```
terraform/
├── infra/                        # STACK 1 (per account)
│   ├── .terraform-version        # required by Stacks, at each Stack root
│   ├── providers.tfcomponent.hcl
│   ├── variables.tfcomponent.hcl
│   ├── components.tfcomponent.hcl
│   ├── outputs.tfcomponent.hcl
│   ├── deployments.tfdeploy.hcl
│   └── modules/                  # child modules used by this Stack
│       ├── dns/                  #   account zone lookup + apex/shopify records
│       ├── ses-identity/         #   SES identity, DKIM, MAIL FROM, config set
│       ├── cert/                 #   ACM cert in us-east-1 (provider passed in)
│       └── cognito-pool/         #   account-level user pool (trimmed)
└── platform/                     # STACK 2 (per environment)
    ├── (same *.hcl + .terraform-version file set)
    └── modules/
        ├── cognito-client/       #   per-env app client
        └── shopify-events/       #   per-env event bus + SQS
```

Each Stack keeps its own `modules/`. Stacks require module `source` paths to
stay **inside** the Stack root — `../modules` is rejected by the Stacks CLI —
so modules live under `<stack>/modules/` and are referenced as
`./modules/...`. (The two Stacks use disjoint modules, so nothing is
duplicated here; a module genuinely shared by both would be copied or pulled
from a registry.)

In a Stack, **modules never configure their own providers** — the provider is
declared in `providers.tfcomponent.hcl` and handed to each component via
`providers = {…}` (see how `aws.us_east_1` is threaded into `cert` for the
Cognito login cert).

Each Stack root also needs a `.terraform-version` file (the Stacks CLI and HCP
Terraform read it to pin the runtime).

## Getting it running (one-time setup)

1. **HCP Terraform**: create a project (e.g. `forgedandfound`) and add two
   Stacks pointed at this repo, with working directories `terraform/infra` and
   `terraform/platform`. Both Stacks must be in the **same project** for
   `upstream_input` to work.
2. **AWS OIDC role**: in each account create an IAM role
   `ff-terraform-stacks` that trusts HCP Terraform's OIDC provider
   (`app.terraform.io`) with audience `aws.workload.identity`, granting the
   permissions these resources need.
3. **Fill placeholders**: replace `<ORG>`, `<NONPROD_ACCOUNT_ID>`,
   `<PROD_ACCOUNT_ID>`, and the `<*_SHOPIFY_APP_ID>` values in the two
   `*.tfdeploy.hcl` files.
4. **Order**: deploy `infra` first (it publishes the pool ids), then `platform`.

## Local authoring loop

```
task fmt                 # format everything
task validate STACK=infra
task validate:all        # validate both Stacks
```

(Plan/apply themselves happen on HCP Terraform, triggered by VCS pushes.)

## Deliberately deferred (iteration 2)

- Cognito: custom-email-sender + post-confirmation Lambdas, KMS key, SMS via
  SNS role, and social IdPs (Google/Apple/Facebook).
- The container-image Lambda module from `../infra/modules/lambda`
  (ECR + docker build/push) and the auth/shopify services.
- Per-env Vercel DNS CNAME (was mixed into the old `dns.tf`).
- A generated/self-service flow for ephemeral environments.

