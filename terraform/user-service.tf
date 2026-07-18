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
