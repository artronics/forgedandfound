# ---------------------------------------------------------------------------
# Cognito trigger lambdas. These are account-level (not platform) because they
# are wired into the shared user pool's lambda_config. One lambda serves every
# platform deployment, which is why the email hook takes wildcard origin
# patterns rather than an exact origin list.
# ---------------------------------------------------------------------------

locals {
  default_app_url = local.is_prod ? "https://${var.root_domain}" : "https://development.${var.root_domain}"

  allowed_app_origins = local.is_prod ? [
    "https://${var.root_domain}",
    "https://www.${var.root_domain}",
    ] : [
    "https://*.${local.account_zone_name}", # every platform deployment
    "https://*.${var.root_domain}",         # vercel simple URLs (development., preview.)
    "http://localhost:3000",
  ]
}

# --- auth-email-hook-handler (Cognito Custom Email Sender) ------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "auth_email_hook" {
  name               = "${local.prefix}-auth-email-hook-handler-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "auth_email_hook_basic" {
  role       = aws_iam_role.auth_email_hook.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "auth_email_hook" {
  statement {
    sid    = "SESSend"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      aws_sesv2_email_identity.account.arn,
      "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${aws_sesv2_configuration_set.cognito.configuration_set_name}",
    ]
  }

  statement {
    sid       = "KMSDecrypt"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.cognito_email.arn]
  }
}

resource "aws_iam_role_policy" "auth_email_hook" {
  name   = "ses-kms"
  role   = aws_iam_role.auth_email_hook.id
  policy = data.aws_iam_policy_document.auth_email_hook.json
}

module "auth_email_hook_handler" {
  source = "../modules/lambda-service"

  service_name  = "auth-email-hook-handler"
  function_name = "${local.prefix}-auth-email-hook-handler"
  repo_url      = aws_ecr_repository.service["auth-email-hook-handler"].repository_url
  role_arn      = aws_iam_role.auth_email_hook.arn
  region        = var.region

  log_retention_days    = local.is_prod ? 60 : 14
  application_log_level = local.is_prod ? "INFO" : "DEBUG"

  environment_variables = {
    SES_FROM_ADDRESS      = "${var.from_email}@${local.ses_domain}"
    SES_CONFIGURATION_SET = aws_sesv2_configuration_set.cognito.configuration_set_name
    KMS_KEY_ID            = aws_kms_key.cognito_email.arn
    APP_URL               = local.default_app_url
    ALLOWED_APP_ORIGINS   = join(",", local.allowed_app_origins)
  }

  permissions = [
    {
      statement_id = "AllowCognitoInvoke"
      principal    = "cognito-idp.amazonaws.com"
      source_arn   = aws_cognito_user_pool.main.arn
    }
  ]
}

# --- auth-shopify-customer-sync-handler (PreSignUp / PostConfirmation) ------

resource "aws_iam_role" "shopify_sync" {
  name               = "${local.prefix}-auth-shopify-customer-sync-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "shopify_sync_basic" {
  role       = aws_iam_role.shopify_sync.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "shopify_sync" {
  statement {
    sid       = "CognitoUpdateAttributes"
    effect    = "Allow"
    actions   = ["cognito-idp:AdminUpdateUserAttributes"]
    resources = [aws_cognito_user_pool.main.arn]
  }

  statement {
    sid    = "SESSend"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = [
      aws_sesv2_email_identity.account.arn,
      "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${aws_sesv2_configuration_set.cognito.configuration_set_name}",
    ]
  }

  statement {
    sid     = "SecretsManagerRead"
    effect  = "Allow"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:${var.shopify_secret_name}-*",
    ]
  }
}

resource "aws_iam_role_policy" "shopify_sync" {
  name   = "cognito-ses-secrets"
  role   = aws_iam_role.shopify_sync.id
  policy = data.aws_iam_policy_document.shopify_sync.json
}

module "auth_shopify_customer_sync_handler" {
  source = "../modules/lambda-service"

  service_name  = "auth-shopify-customer-sync-handler"
  function_name = "${local.prefix}-auth-shopify-customer-sync-handler"
  repo_url      = aws_ecr_repository.service["auth-shopify-customer-sync-handler"].repository_url
  role_arn      = aws_iam_role.shopify_sync.arn
  region        = var.region

  log_retention_days    = local.is_prod ? 60 : 14
  application_log_level = local.is_prod ? "INFO" : "DEBUG"

  environment_variables = {
    SHOPIFY_SECRET_NAME = var.shopify_secret_name
    # Synthetic addresses for users whose provider gives us no email. A
    # subdomain we never configure for mail, so these addresses can't be
    # delivered to even by accident.
    PLACEHOLDER_EMAIL_DOMAIN = "no-reply.${local.account_zone_name}"
    # For the password-changed notification sent on PostConfirmation_ConfirmForgotPassword.
    SES_FROM_ADDRESS      = "${var.from_email}@${local.ses_domain}"
    SES_CONFIGURATION_SET = aws_sesv2_configuration_set.cognito.configuration_set_name
  }

  permissions = [
    {
      statement_id = "AllowCognitoInvoke"
      principal    = "cognito-idp.amazonaws.com"
      source_arn   = aws_cognito_user_pool.main.arn
    }
  ]
}
