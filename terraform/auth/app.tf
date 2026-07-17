locals {
  prod_urls    = ["https://${var.root_zone_name}"]
  nonprod_urls = concat(formatlist("https://%s", var.store_domains), ["http://localhost:3000"])
  app_urls     = local.is_prod ? local.prod_urls : local.nonprod_urls

  app_callback_urls = formatlist("%s/api/auth/callback/cognito", local.app_urls)
  app_logout_urls   = local.app_urls
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.prefix}-web-app"
  user_pool_id = aws_cognito_user_pool.main.id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  # aws.cognito.signin.user.admin lets the access token call the user-pool
  # self-service APIs (UpdateUserAttributes / VerifyUserAttribute), which the
  # account-service uses to change an email with Cognito's own verification.
  # Credentials sign-in grants it implicitly; the hosted-UI/OIDC flow only gets it
  # if it's allowed and requested here.
  allowed_oauth_scopes         = ["openid", "email", "profile", "aws.cognito.signin.user.admin"]
  supported_identity_providers = ["COGNITO", "Google", "SignInWithApple", "Facebook"]

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
