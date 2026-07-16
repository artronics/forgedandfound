module "image" {
  source      = "../../docker"
  prefix      = var.prefix
  aws_profile = var.aws_profile

  service_name         = var.service_name
  package_dependencies = local.service_dependencies
}

module "lambda" {
  source      = "../../lambda"
  prefix      = var.prefix
  aws_account = var.aws_account
  aws_profile = var.aws_profile

  function_name = var.service_name
  role_arn      = aws_iam_role.auth_lambda.arn
  image_uri     = module.image.image_uri

  environment_variables = {
    SES_FROM_ADDRESS      = "no-reply@${var.ses_domain}"
    SES_CONFIGURATION_SET = var.ses_config_set_name
    KMS_KEY_ID            = var.cognito_email_kms_key_arn
    ACCOUNT_URL           = "https://${var.cognito_domain}"
    APP_URL               = var.app_url
  }

  permissions = [
    {
      statement_id = "AllowCognitoInvoke"
      principal    = "cognito-idp.amazonaws.com"
      source_arn   = var.cognito_user_pool_arn
    }
  ]
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
  name               = "${var.prefix}-${var.service_name}-lambda"
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
      var.ses_email_identity_arn,
      "arn:aws:ses:${var.region}:${data.aws_caller_identity.current.account_id}:configuration-set/${var.ses_config_set_name}",
    ]
  }

  statement {
    sid       = "KMSDecrypt"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [var.cognito_email_kms_key_arn]
  }
}

resource "aws_iam_role_policy" "auth_lambda" {
  name   = "ses-kms"
  role   = aws_iam_role.auth_lambda.id
  policy = data.aws_iam_policy_document.auth_lambda.json
}
