locals {
  account_service_name = "account-service"
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
      "cognito-idp:AdminUpdateUserAttributes",
      "cognito-idp:AdminDeleteUser",
      "cognito-idp:AdminSetUserPassword",
    ]
    resources = [module.auth.cognito_user_pool_arn]
  }

  statement {
    sid       = "ShopifySecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:forgedandfound/infra/shopify-*"]
  }
}

resource "aws_iam_role_policy" "account_service" {
  name   = "cognito-admin-shopify"
  role   = aws_iam_role.account_service.id
  policy = data.aws_iam_policy_document.account_service.json
}
