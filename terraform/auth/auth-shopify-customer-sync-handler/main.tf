variable "prefix" {}
variable "region" {
  default = "eu-west-2"
}
variable "aws_profile" {}
variable "cognito_user_pool_arn" {}

data "aws_caller_identity" "current" {}

locals {
  service_name = "auth-shopify-customer-sync-handler"
  service_dependencies = ["shopify-admin-client", "secret-manager"]
}

output "function_arn" {
  value = module.lambda.function_arn
}