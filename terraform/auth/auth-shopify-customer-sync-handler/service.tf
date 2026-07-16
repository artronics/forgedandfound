module "image" {
  source      = "../../docker"
  prefix      = var.prefix
  region      = var.region
  aws_profile = var.aws_profile

  service_name         = var.service_name
  package_dependencies = local.service_dependencies
}

module "lambda" {
  source      = "../../lambda"
  prefix      = var.prefix
  aws_account = var.aws_account
  region      = var.region
  aws_profile = var.aws_profile

  function_name = "${var.prefix}-${var.service_name}"
  role_arn      = aws_iam_role.lambda_role.arn
  image_uri     = module.image.image_uri

  environment_variables = {
    SHOPIFY_SECRET_NAME = "forgedandfound/infra/shopify"
    # Synthetic addresses for users whose provider gives us no email. Never
    # deliverable and never emailed — they exist so every user can have a Shopify
    # customer to link against.
    PLACEHOLDER_EMAIL_DOMAIN = var.placeholder_email_domain
  }
}

resource "aws_lambda_permission" "cognito_permissions" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = var.cognito_user_pool_arn
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.prefix}-shopify-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_policy_doc" {
  statement {
    sid    = "CognitoUpdateAttributes"
    effect = "Allow"
    actions = [
      "cognito-idp:AdminUpdateUserAttributes",
      "cognito-idp:ListUsers",
      "cognito-idp:AdminLinkProviderForUser",
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminSetUserPassword",
    ]
    resources = [var.cognito_user_pool_arn]
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

resource "aws_iam_role_policy" "cognito_attr_update_policy" {
  name   = "cognito-update"
  role   = aws_iam_role.lambda_role.id
  policy = data.aws_iam_policy_document.lambda_policy_doc.json
}

