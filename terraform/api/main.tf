variable "aws_profile" {}
variable "prefix" {}
variable "aws_account" {}

variable "region" {
  default = "eu-west-2"
}

variable "root_domain" {}

variable "cognito_user_pool_arn" {
  description = "ARN of the Cognito user pool backing the API's authorizer."
}

variable "account_service_invoke_arn" {
  description = "invoke_arn of the account-service Lambda, used as the aws_proxy integration uri."
}

variable "account_service_function_name" {
  description = "Name of the account-service Lambda, granted API Gateway invoke permission."
}

locals {
  is_prod    = var.aws_account == "prod"
  api_domain = "api.${var.aws_account}.${var.root_domain}"
}
