module "idp_google_secret" {
  source = "../secret"
  name   = "forgedandfound/infra/auth/idp/google"
}
module "idp_facebook_secret" {
  source = "../secret"
  name   = "forgedandfound/infra/auth/idp/facebook"
}
module "idp_apple_secret" {
  source = "../secret"
  name   = "forgedandfound/infra/auth/idp/apple"
}

locals {
  cognito_user_pool_id = aws_cognito_user_pool.main.id
  idp_google_creds     = module.idp_google_secret.secret_map
  idp_apple_creds      = module.idp_apple_secret.secret_map
  idp_facebook_creds   = module.idp_facebook_secret.secret_map
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = local.cognito_user_pool_id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = local.idp_google_creds["google_client_id"]
    client_secret    = local.idp_google_creds["google_client_secret"]
    authorize_scopes = "email profile openid https://www.googleapis.com/auth/user.phonenumbers.read"
  }

  # Name attributes are deliberately NOT mapped. The native Cognito profile is the
  # source of truth and the user sets their name in our UI; Cognito re-applies
  # this mapping on federated sign-in, so mapping names here would let Google
  # overwrite what the user chose on every login.
  #
  # email_verified MUST be mapped: Cognito re-applies this mapping on every
  # federated sign-in and stamps email_verified=false on the linked native user
  # unless the provider's claim is mapped through. Without it, social-first
  # users can never use ForgotPassword (no verified email).
  # phone_number is deliberately NOT mapped: Google's People-API `phoneNumbers`
  # claim isn't an E.164 string (and is an empty list when absent), and Cognito
  # re-applies mappings on every sign-in of a linked user — a bad value there
  # fails the whole sign-in. Nothing consumes an imported phone; the profile UI
  # owns it, same rationale as names above.
  attribute_mapping = {
    email                        = "email"
    email_verified               = "email_verified"
    username                     = "sub"
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
  user_pool_id  = local.cognito_user_pool_id
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
  user_pool_id  = local.cognito_user_pool_id
  provider_name = "Facebook"
  provider_type = "Facebook"

  provider_details = {
    client_id        = local.idp_facebook_creds["facebook_client_id"]
    client_secret    = local.idp_facebook_creds["facebook_client_secret"]
    authorize_scopes = "public_profile,email"
  }

  # Names deliberately unmapped — see the Google provider above.
  attribute_mapping = {
    username                     = "id"
    email                        = "email"
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

