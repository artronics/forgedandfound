data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "user_service" {
  name               = "${local.prefix}-user-service-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "user_service_basic" {
  role       = aws_iam_role.user_service.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# The service applies users' own profile edits (name, email + email_verified,
# marketing consent) and deletes their account — the admin calls live here
# because the web app runs on Vercel with no AWS credentials.
data "aws_iam_policy_document" "user_service_cognito" {
  statement {
    sid    = "CognitoAdminUserWrite"
    effect = "Allow"
    actions = [
      "cognito-idp:AdminUpdateUserAttributes",
      "cognito-idp:AdminDeleteUser",
    ]
    resources = [data.terraform_remote_state.infra.outputs.cognito_user_pool_arn]
  }
}

resource "aws_iam_role_policy" "user_service_cognito" {
  name   = "cognito-update"
  role   = aws_iam_role.user_service.id
  policy = data.aws_iam_policy_document.user_service_cognito.json
}

module "user_service" {
  source = "../modules/lambda-service"

  service_name  = "user-service"
  function_name = "${local.prefix}-user-service"
  repo_url      = data.terraform_remote_state.infra.outputs.ecr_repo_urls["user-service"]
  role_arn      = aws_iam_role.user_service.arn
  region        = var.region

  log_retention_days    = local.is_prod ? 60 : 14
  application_log_level = local.is_prod ? "INFO" : "DEBUG"

  environment_variables = {
    USER_POOL_ID = data.terraform_remote_state.infra.outputs.cognito_user_pool_id
  }
}
