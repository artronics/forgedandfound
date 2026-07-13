# ---------------------------------------------------------------------------
# Cognito app client – PER ENVIRONMENT.
#
# Each environment (development / preview / staging / production / ephemeral)
# gets its own client against the account-level user pool created by the infra
# Stack. The pool id is fed in from the infra Stack via upstream_input.
# ---------------------------------------------------------------------------

variable "prefix" {
  type        = string
  description = "Per-environment naming prefix, e.g. ff-development"
}

variable "user_pool_id" {
  type        = string
  description = "Account-level Cognito user pool id (from the infra Stack)"
}

variable "app_urls" {
  type = list(string)
  description = "Base app URLs for this environment (e.g. https://development.forgedandfound.co.uk, http://localhost:3000)"
}

variable "supported_identity_providers" {
  type = list(string)
  default = ["COGNITO"]
}

locals {
  callback_urls = formatlist("%s/api/auth/callback/cognito", var.app_urls)
  logout_urls = var.app_urls
}

resource "aws_cognito_user_pool_client" "app" {
  name         = var.prefix
  user_pool_id = var.user_pool_id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows = ["code"]
  allowed_oauth_scopes = ["openid", "email", "profile"]
  supported_identity_providers         = var.supported_identity_providers

  callback_urls = local.callback_urls
  logout_urls   = local.logout_urls

  generate_secret = true

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
}

output "client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "client_secret" {
  value     = aws_cognito_user_pool_client.app.client_secret
  sensitive = true
}
