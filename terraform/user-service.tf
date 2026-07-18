locals {
  user_service_name = "user-service"
}
module "user_service_image" {
  source      = "./docker"
  prefix      = local.prefix
  aws_profile = var.aws_profile

  service_name         = local.user_service_name
  package_dependencies = ["logger"]
}

module "user_service_lambda" {
  source      = "./lambda"
  prefix      = local.prefix
  aws_account = var.aws_account
  aws_profile = var.aws_profile

  function_name = "${local.prefix}-${local.user_service_name}"
  image_uri     = module.user_service_image.image_uri
  role_arn      = aws_iam_role.user_service.arn

  environment_variables = {
    USER_POOL_ID = module.auth.cognito_user_pool_id
  }
}

data "aws_iam_policy_document" "user_service_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "user_service" {
  name               = "${local.prefix}-${local.user_service_name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.user_service_assume.json
}

resource "aws_iam_role_policy_attachment" "user_service_basic" {
  role       = aws_iam_role.user_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# The service applies users' own profile edits (name, email + email_verified,
# marketing consent) — the admin call lives here because the web app runs on
# Vercel with no AWS credentials.
data "aws_iam_policy_document" "user_service_cognito" {
  statement {
    sid       = "CognitoUpdateAttributes"
    effect    = "Allow"
    actions   = ["cognito-idp:AdminUpdateUserAttributes"]
    resources = [module.auth.cognito_user_pool_arn]
  }
}

resource "aws_iam_role_policy" "user_service_cognito" {
  name   = "${local.prefix}-${local.user_service_name}-cognito"
  role   = aws_iam_role.user_service.id
  policy = data.aws_iam_policy_document.user_service_cognito.json
}
