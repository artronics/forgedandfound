# Components of the platform Stack — per-environment resources. One set exists
# per deployment (development / preview / staging / production / ephemeral).

locals {
  # Per-environment prefix. Driven by `namespace` so ephemeral environments
  # (pr-123, dev-alice, ...) get their own conflict-free resource names.
  prefix = "ff-${var.namespace}"
}

# Per-environment app client against the account-level Cognito pool created by
# the infra Stack. `cognito_user_pool_id` arrives via upstream_input.
component "auth_client" {
  source = "./modules/cognito-client"

  inputs = {
    prefix       = local.prefix
    user_pool_id = var.cognito_user_pool_id
    app_urls     = var.app_urls
    # TODO(iteration-2): add "Google","SignInWithApple","Facebook" once the
    # IdPs are wired into the pool in the infra Stack.
    supported_identity_providers = ["COGNITO"]
  }

  providers = {
    aws = provider.aws.this
  }
}

component "shopify_events" {
  source = "./modules/shopify-events"

  inputs = {
    prefix         = local.prefix
    shopify_app_id = var.shopify_app_id
  }

  providers = {
    aws = provider.aws.this
  }
}
