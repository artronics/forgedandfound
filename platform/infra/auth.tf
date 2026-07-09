# ---------------------------------------------------------------------------
# Cognito – account-level user pool (one per account: nonprod / prod)
# Clients (apps) are created by per-app Terraform, not here.
# ---------------------------------------------------------------------------

locals {
  cognito_domain = "account.${data.aws_route53_zone.account_root_zone.name}"
}

resource "aws_cognito_user_pool" "main" {
  name = "${local.prefix}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  mfa_configuration = "OFF"

  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = aws_sesv2_email_identity.account.arn
    from_email_address    = "noreply@${local.ses_domain}"
    configuration_set     = aws_sesv2_configuration_set.main.configuration_set_name
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  lambda_config {
    custom_email_sender {
      lambda_arn     = module.auth_lambda.function_arn
      lambda_version = "V1_0"
    }
    kms_key_id        = aws_kms_key.cognito_email.arn
    post_confirmation = module.shopify_lambda.function_arn
  }

  schema {
    name                = "shopify_customer_id"
    attribute_data_type = "String"
    mutable             = true
    required            = false
    string_attribute_constraints {
      min_length = "0"
      max_length = "256"
    }
  }
}

module "cognito_domain_cert" {
  source      = "./modules/cert"
  domain_name = local.cognito_domain
  zone_id     = data.aws_route53_zone.account_root_zone.zone_id
}

resource "aws_cognito_user_pool_domain" "main" {
  domain                = local.cognito_domain
  user_pool_id          = aws_cognito_user_pool.main.id
  certificate_arn       = module.cognito_domain_cert.cert_arn
  managed_login_version = 2
}

resource "aws_route53_record" "cognito_domain" {
  zone_id = data.aws_route53_zone.account_root_zone.zone_id
  name    = local.cognito_domain
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront hosted zone ID (global constant)
    evaluate_target_health = false
  }
}

data "aws_secretsmanager_secret" "idp_google" {
  name = "forgedandfound/infra/auth/idp/google"
}
data "aws_secretsmanager_secret_version" "idp_google_secret" {
  secret_id = data.aws_secretsmanager_secret.idp_google.id
}
locals {
  idp_google_creds = jsondecode(data.aws_secretsmanager_secret_version.idp_google_secret.secret_string)
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = local.idp_google_creds["google_client_id"]
    client_secret    = local.idp_google_creds["google_client_secret"]
    authorize_scopes = "email profile openid"
  }

  attribute_mapping = {
    email                        = "email"
    username                     = "sub"
    given_name                   = "given_name"
    family_name                  = "family_name"
    phone_number                 = "phoneNumbers"
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

# ---------------------------------------------------------------------------
# Outputs – consumed by per-app Terraform
# ---------------------------------------------------------------------------

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "cognito_endpoint" {
  value = "https://${local.cognito_domain}"
}

# ---------------------------------------------------------------------------
# KMS – encrypts codes passed to the custom email sender Lambda
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "cognito_kms_key" {
  statement {
    sid    = "EnableRootAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "CognitoEncrypt"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cognito-idp.amazonaws.com"]
    }
    actions = [
      "kms:GenerateDataKey",
      "kms:Encrypt",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "cognito_email" {
  description             = "Cognito custom email sender – code encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cognito_kms_key.json
}

resource "aws_kms_alias" "cognito_email" {
  name          = "alias/${local.prefix}-cognito-email"
  target_key_id = aws_kms_key.cognito_email.key_id
}

# ---------------------------------------------------------------------------
# IAM – execution role for the auth Lambda
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "auth_lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "auth_lambda" {
  name               = "${local.prefix}-auth-lambda"
  assume_role_policy = data.aws_iam_policy_document.auth_lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "auth_lambda_basic" {
  role       = aws_iam_role.auth_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "auth_lambda" {
  statement {
    sid    = "SESSend"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      aws_sesv2_email_identity.account.arn,
      "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${aws_sesv2_configuration_set.main.configuration_set_name}",
    ]
  }

  statement {
    sid       = "KMSDecrypt"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.cognito_email.arn]
  }
}

resource "aws_iam_role_policy" "auth_lambda" {
  name   = "ses-kms"
  role   = aws_iam_role.auth_lambda.id
  policy = data.aws_iam_policy_document.auth_lambda.json
}

# ---------------------------------------------------------------------------
# Lambda – auth
# ---------------------------------------------------------------------------

module "auth_lambda" {
  source = "./modules/lambda"

  name        = "auth"
  prefix      = local.prefix
  region      = var.region
  aws_profile = var.aws_profile
  role_arn    = aws_iam_role.auth_lambda.arn

  environment_variables = {
    SES_FROM_ADDRESS      = "noreply@${local.ses_domain}"
    SES_CONFIGURATION_SET = aws_sesv2_configuration_set.main.configuration_set_name
    KMS_KEY_ID            = aws_kms_key.cognito_email.arn
    ACCOUNT_URL           = "https://${local.cognito_domain}"
    APP_URL               = local.app_url
  }

  permissions = [{
    statement_id = "AllowCognitoInvoke"
    principal    = "cognito-idp.amazonaws.com"
    source_arn   = aws_cognito_user_pool.main.arn
  }]
}

# ---------------------------------------------------------------------------
# IAM – execution role for the shopify Lambda
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "shopify_lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "shopify_lambda" {
  name               = "${local.prefix}-shopify-lambda"
  assume_role_policy = data.aws_iam_policy_document.shopify_lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "shopify_lambda_basic" {
  role       = aws_iam_role.shopify_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "shopify_lambda" {
  statement {
    sid       = "CognitoUpdateAttributes"
    effect    = "Allow"
    actions   = ["cognito-idp:AdminUpdateUserAttributes"]
    resources = [aws_cognito_user_pool.main.arn]
  }

  statement {
    sid     = "SecretsManagerRead"
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:forgedandfound/infra/shopify-*",
    ]
  }
}

resource "aws_iam_role_policy" "shopify_lambda" {
  name   = "cognito-update"
  role   = aws_iam_role.shopify_lambda.id
  policy = data.aws_iam_policy_document.shopify_lambda.json
}

# ---------------------------------------------------------------------------
# Lambda – shopify
# Permissions are wired outside the module to avoid a circular dependency
# (user pool references the lambda ARN; lambda permission references the pool ARN)
# ---------------------------------------------------------------------------

module "shopify_lambda" {
  source = "./modules/lambda"

  name        = "shopify"
  prefix      = local.prefix
  region      = var.region
  aws_profile = var.aws_profile
  role_arn    = aws_iam_role.shopify_lambda.arn
  context_dir = "${path.root}/../services"

  environment_variables = {
    SHOPIFY_SECRET_NAME = "forgedandfound/infra/shopify"
  }
}

resource "aws_lambda_permission" "shopify_cognito" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.shopify_lambda.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.main.arn
}
