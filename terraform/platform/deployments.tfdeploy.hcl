# Deployments of the platform Stack — ONE PER ENVIRONMENT.
#
#   nonprod account : development, preview   (+ ephemeral pr-*/dev-* envs)
#   prod account    : staging, production

identity_token "aws" {
  audience = ["aws.workload.identity"]
}

upstream_input "infra" {
  type   = "stack"
  source = "app.terraform.io/forgedandfound/retail/infra"
}

locals {
  nonprod_role = "arn:aws:iam::939103584423:role/TerraformDeployRole"
  prod_role    = "arn:aws:iam::028607041427:role/TerraformDeployRole"

  nonprod_shopify_app_id = "<NONPROD_SHOPIFY_APP_ID>"
  prod_shopify_app_id    = "<PROD_SHOPIFY_APP_ID>"
}

# --- nonprod account ---------------------------------------------------------

deployment "development" {
  inputs = {
    account              = "nonprod"
    environment          = "development"
    namespace            = "development"
    region               = "eu-west-2"
    role_arn             = local.nonprod_role
    aws_token            = identity_token.aws.jwt
    shopify_app_id       = local.nonprod_shopify_app_id
    cognito_user_pool_id = upstream_input.infra.nonprod_user_pool_id
    app_urls = ["http://localhost:3000", "https://development.forgedandfound.co.uk"]
  }
}

deployment "preview" {
  inputs = {
    account              = "nonprod"
    environment          = "preview"
    namespace            = "preview"
    region               = "eu-west-2"
    role_arn             = local.nonprod_role
    aws_token            = identity_token.aws.jwt
    shopify_app_id       = local.nonprod_shopify_app_id
    cognito_user_pool_id = upstream_input.infra.nonprod_user_pool_id
    app_urls = ["https://preview.forgedandfound.co.uk"]
  }
}

# --- prod account ------------------------------------------------------------

deployment "staging" {
  inputs = {
    account              = "prod"
    environment          = "staging"
    namespace            = "staging"
    region               = "eu-west-2"
    role_arn             = local.prod_role
    aws_token            = identity_token.aws.jwt
    shopify_app_id       = local.prod_shopify_app_id
    cognito_user_pool_id = upstream_input.infra.prod_user_pool_id
    app_urls = ["https://staging.forgedandfound.co.uk"]
  }
}

deployment "production" {
  inputs = {
    account              = "prod"
    environment          = "production"
    namespace            = "production"
    region               = "eu-west-2"
    role_arn             = local.prod_role
    aws_token            = identity_token.aws.jwt
    shopify_app_id       = local.prod_shopify_app_id
    cognito_user_pool_id = upstream_input.infra.prod_user_pool_id
    app_urls = ["https://forgedandfound.co.uk"]
  }
}

# --- Ephemeral / per-user environments (FUTURE, out of scope for now) --------
#
# The `namespace` input is what makes these safe: every resource is prefixed
# ff-${namespace}, so an isolated stack can be spun up and torn down without
# touching the shared environments. To add one, drop in another deployment:
#
# deployment "pr-123" {
#   inputs = {
#     account              = "nonprod"
#     environment          = "development"   # behaves like dev
#     namespace            = "pr-123"        # <- unique prefix => ff-pr-123-*
#     region               = "eu-west-2"
#     role_arn             = local.nonprod_role
#     aws_token            = identity_token.aws.jwt
#     shopify_app_id       = local.nonprod_shopify_app_id
#     cognito_user_pool_id = upstream_input.infra.nonprod_user_pool_id
#     app_urls             = ["https://pr-123.forgedandfound.co.uk"]
#   }
# }
#
# Later this can be generated instead of hand-written (a small generator, or a
# separate "ephemeral" Stack whose deployments come from a variable set), so a
# developer can create/destroy their own env from the command line.
