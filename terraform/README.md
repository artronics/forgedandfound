# Terraform

Two root modules, split by lifecycle:

| Root | Scope | State |
|---|---|---|
| `infra/` | One apply per AWS account (`nonprod`/`prod`). Account singletons: Route53 zones, Cognito user pool + IdPs + trigger lambdas, SES identity, ECR repos, Shopify partner event bus. | `artronics-ff-<account>-infra-tf-state` / `infra.tfstate` |
| `platform/` | One apply per deployment. Nonprod deployments are free-form names; prod deployments are `staging`/`live`. Per-deployment: Cognito app client, user-service lambda, API Gateway + custom domain, event queues, DNS records. | `artronics-ff-<account>-platform-tf-state` / `deployments/<name>.tfstate` |

Two names are special:

- **`preview`** — a real, permanent deployment (the test env; Vercel Preview
  points at it) and the only one wired to the `prv` infra environment.
  `task tf:platform:destroy` refuses it unconditionally.
- **`development`** — *not* a deployment, just a reserved namespace. Infra owns
  the `development.nonprod.forgedandfound.co.uk` →
  `development.forgedandfound.co.uk` alias; there are no platform resources
  behind it and `platform` rejects it as a deployment name. Deploy under your
  own name (e.g. `pr-123`) and alias whatever Vercel deployment you like onto
  `development.forgedandfound.co.uk`.

`platform` reads `infra` outputs via `terraform_remote_state`. `modules/` holds
the only reusable modules: `cert` (us-east-1 ACM + DNS validation) and
`lambda-service` (content-hash-tagged container image + lambda; skips the
docker build when the tag already exists in ECR, and derives workspace
dependencies from the service's `package.json`).

## Environments & namespaces

```
namespace  ff/<infra|platform>/<account>/<env|deployment>
prefix     namespace with '-' instead of '/'
```

Infra environments: `dev`/`prv` (nonprod), `staging`/`live` (prod), each with a
public zone `<env>.<account>.forgedandfound.co.uk`. `preview` is the only
platform deployment wired to `prv`; all other nonprod deployments use `dev`.

## Auth

No `aws_profile` variable — credentials are ambient. Locally `.env.terraform`
(auto-loaded by Task) sets `AWS_PROFILE`; CI assumes the GitHub OIDC role. The
providers pin `allowed_account_ids` per account, so an apply with the wrong
account's credentials fails before touching anything. **The prod account id is
deliberately left empty** in `aws_account_ids` until the prod migration.

## Usage

From repo root (needs `TF_VAR_aws_account`, from `.env.terraform`):

```
task tf:infra:init
task tf:infra:plan
task tf:infra:apply

task tf:platform:init  DEPLOYMENT=foo
task tf:platform:plan  DEPLOYMENT=foo
task tf:platform:apply DEPLOYMENT=foo
task tf:platform:destroy DEPLOYMENT=foo        # refuses prod and preview
```

Per-deployment settings live in `platform/env/<deployment>.tfvars` (optional
for ephemerals; `preview` has a committed file).

## Prod migration (deferred)

Prod has not been migrated to this layout. Before the first prod apply:

1. Fill `aws_account_ids.prod` in both root modules.
2. Manually delete the pre-existing Vercel/Shopify/SES records from the root
   zone (apex A, `development.`/`preview.`/`production.`/`www.`/`shopify.`
   CNAMEs, SES DKIM/`mail.` records) so terraform can create its own — infra
   owns everything Vercel- and Shopify-related in the root zone. **Google
   Workspace records (apex MX, `google._domainkey`, apex TXT site
   verification) stay; terraform never defines them.**
3. Decide whether the existing prod user pool is imported or replaced.
