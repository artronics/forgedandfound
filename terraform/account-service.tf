locals {
  account_service_name = "account-service"
  # Storefront origins allowed in emailed links — mirrors auth/app.tf.
  account_app_urls = var.aws_account == "prod" ? ["https://${var.root_domain}"] : concat(
    formatlist("https://%s.${var.root_domain}", var.store_nonprod_subdomains),
    ["http://localhost:3000"],
  )
}

# Signs the email change/merge verification tokens (see account-service/tokens.ts).
resource "random_password" "email_change_secret" {
  length  = 48
  special = false
}
module "account_service_image" {
  source      = "./docker"
  prefix      = local.prefix
  aws_profile = var.aws_profile

  service_name         = local.account_service_name
  package_dependencies = ["logger", "email", "shopify-admin-client", "secret-manager"]
}

module "account_service_lambda" {
  source      = "./lambda"
  prefix      = local.prefix
  aws_account = var.aws_account
  aws_profile = var.aws_profile

  function_name = "${local.prefix}-${local.account_service_name}"
  image_uri     = module.account_service_image.image_uri
  role_arn      = aws_iam_role.account_service.arn

  environment_variables = {
    USER_POOL_ID          = module.auth.cognito_user_pool_id
    COGNITO_CLIENT_ID     = module.auth.cognito_app_client_id
    COGNITO_CLIENT_SECRET = module.auth.cognito_app_client_secret
    SHOPIFY_SECRET_NAME   = "forgedandfound/infra/shopify"
    # Sender for verification links and security notifications.
    SES_FROM_ADDRESS    = "no-reply@${local.ses_email_domain}"
    APP_URL             = local.account_app_urls[0]
    ALLOWED_APP_ORIGINS = join(",", local.account_app_urls)
    EMAIL_CHANGE_SECRET = random_password.email_change_secret.result
  }
}

# ---------------------------------------------------------------------------
# IAM – execution role for the account-service Lambda
# ---------------------------------------------------------------------------
data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "account_service_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "account_service" {
  name               = "${local.prefix}-${local.account_service_name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.account_service_assume.json
}

resource "aws_iam_role_policy_attachment" "account_service_basic" {
  role       = aws_iam_role.account_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "account_service" {
  statement {
    sid    = "CognitoAdmin"
    effect = "Allow"
    actions = [
      "cognito-idp:AdminGetUser",
      "cognito-idp:AdminUpdateUserAttributes",
      "cognito-idp:AdminDeleteUser",
      "cognito-idp:AdminSetUserPassword",
      # Email-merge flow: find the account holding an address, then move the
      # requester's social identities onto it.
      "cognito-idp:ListUsers",
      "cognito-idp:AdminLinkProviderForUser",
      "cognito-idp:AdminDisableProviderForUser",
    ]
    resources = [module.auth.cognito_user_pool_arn]
  }

  statement {
    sid       = "ShopifySecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:forgedandfound/infra/shopify-*"]
  }

  statement {
    sid       = "SesSendNotification"
    effect    = "Allow"
    actions   = ["ses:SendEmail"]
    resources = [local.ses_email_identity_arn]
  }
}

resource "aws_iam_role_policy" "account_service" {
  name   = "cognito-admin-shopify"
  role   = aws_iam_role.account_service.id
  policy = data.aws_iam_policy_document.account_service.json
}
