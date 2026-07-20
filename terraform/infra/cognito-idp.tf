# Secrets are created out-of-band (never TF-managed); only read here.
data "aws_secretsmanager_secret_version" "idp" {
  for_each = var.idp_secret_names

  secret_id = each.value
}

locals {
  idp_google_creds   = jsondecode(data.aws_secretsmanager_secret_version.idp["google"].secret_string)
  idp_apple_creds    = jsondecode(data.aws_secretsmanager_secret_version.idp["apple"].secret_string)
  idp_facebook_creds = jsondecode(data.aws_secretsmanager_secret_version.idp["facebook"].secret_string)
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = local.idp_google_creds["google_client_id"]
    client_secret    = local.idp_google_creds["google_client_secret"]
    authorize_scopes = "email profile openid https://www.googleapis.com/auth/user.phonenumbers.read"
  }

  # email_verified MUST be mapped: Cognito re-applies this mapping on every
  # federated sign-in and stamps email_verified=false on the user unless the
  # provider's claim is mapped through — silently un-verifying the address
  # (and e.g. breaking ForgotPassword, which needs a verified email).
  # phone_number is deliberately NOT mapped: Google's People-API `phoneNumbers`
  # claim isn't an E.164 string (and is an empty list when absent), and because
  # mappings re-apply on every sign-in, a bad value there fails the whole
  # sign-in.
  attribute_mapping = {
    email                        = "email"
    email_verified               = "email_verified"
    username                     = "sub"
    given_name                   = "given_name"
    family_name                  = "family_name"
    "custom:shopify_customer_id" = "shopify_customer_id"
  }
  lifecycle {
    // https://github.com/hashicorp/terraform-provider-aws/issues/4831#issuecomment-418209566
    ignore_changes = [
      provider_details["attributes_url"],
      provider_details["attributes_url_add_attributes"],
      provider_details["authorize_url"],
      provider_details["token_request_method"],
      provider_details["token_url"],
      provider_details["oidc_issuer"],
    ]
  }
}

resource "aws_cognito_identity_provider" "apple" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "SignInWithApple"
  provider_type = "SignInWithApple"

  provider_details = {
    client_id        = local.idp_apple_creds["apple_client_id"]
    team_id          = local.idp_apple_creds["team_id"]
    key_id           = local.idp_apple_creds["key_id"]
    private_key      = base64decode(local.idp_apple_creds["private_key_b64"])
    authorize_scopes = "email name"
  }

  # email_verified mapped for the same reason as the Google provider above.
  # (Facebook has no such claim — Facebook emails stay unverified.)
  attribute_mapping = {
    email                        = "email"
    email_verified               = "email_verified"
    username                     = "sub"
    "custom:shopify_customer_id" = "shopify_customer_id"
  }

  lifecycle {
    ignore_changes = [
      # NOTE: DO NOT add "private_key" here. It's annoying that it triggers everytime, but it's better than ignoring it.
      provider_details["authorize_url"],
      provider_details["token_url"],
      provider_details["oidc_issuer"],
      provider_details["attributes_url"],
      provider_details["attributes_url_add_attributes"],
      provider_details["jwks_uri"],
      provider_details["token_request_method"],
    ]
  }
}

resource "aws_cognito_identity_provider" "facebook" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Facebook"
  provider_type = "Facebook"

  provider_details = {
    client_id        = local.idp_facebook_creds["facebook_client_id"]
    client_secret    = local.idp_facebook_creds["facebook_client_secret"]
    authorize_scopes = "public_profile,email"
  }

  attribute_mapping = {
    username                     = "id"
    email                        = "email"
    given_name                   = "first_name"
    family_name                  = "last_name"
    name                         = "name"
    "custom:shopify_customer_id" = "shopify_customer_id"
  }

  lifecycle {
    ignore_changes = [
      provider_details["authorize_url"],
      provider_details["token_url"],
      provider_details["attributes_url"],
      provider_details["jwks_uri"],
      provider_details["attributes_url_add_attributes"],
      provider_details["token_request_method"],
    ]
  }
}
