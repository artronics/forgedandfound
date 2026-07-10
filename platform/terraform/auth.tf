locals {
  app_prod_callback_url = ["https://${var.root_domain}"]
  app_nonprod_callback_url = ["http://localhost:3000"]
  app_urls = concat(
    ["https://${local.store_domain}"],
      var.aws_account == "prod" ? local.app_prod_callback_url : local.app_nonprod_callback_url
  )

  app_callback_urls = formatlist("%s/api/auth/callback/cognito", local.app_urls)
  app_logout_urls = local.app_urls
}

resource "aws_cognito_user_pool_client" "app" {
  name         = local.prefix
  user_pool_id = local.cognito_user_pool_id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows = ["code"]
  allowed_oauth_scopes = ["openid", "email", "profile", "name"]
  supported_identity_providers = ["COGNITO", "Google", "SignInWithApple"]

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
