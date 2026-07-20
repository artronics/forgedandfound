# Each deployment gets its own app client on the shared (account-level) user
# pool — callback URLs differ per deployment; everything else is identical.

locals {
  app_urls = distinct(concat(
    ["https://${local.deployment_domain}"],
    var.extra_app_urls,
    local.is_prod ? ["https://${var.root_domain}", "https://www.${var.root_domain}"] : ["http://localhost:3000"],
  ))

  app_callback_urls = formatlist("%s/api/auth/callback/cognito", local.app_urls)
  app_logout_urls   = local.app_urls
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "${local.prefix}-web-app"
  user_pool_id = data.terraform_remote_state.infra.outputs.cognito_user_pool_id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["COGNITO", "Google", "SignInWithApple", "Facebook"]

  callback_urls = local.app_callback_urls
  logout_urls   = local.app_logout_urls

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

# The pool domain runs managed login v2; a client without a branding style
# gets an error page on the hosted UI, so assign Cognito's defaults.
resource "aws_cognito_managed_login_branding" "app" {
  user_pool_id = data.terraform_remote_state.infra.outputs.cognito_user_pool_id
  client_id    = aws_cognito_user_pool_client.app.id

  use_cognito_provided_values = true
}
