variable "prefix" {}
variable "aws_account" {}
variable "region" {
  default = "eu-west-2"
}
variable "aws_profile" {}
variable "cognito_user_pool_arn" {}
variable "service_name" {}
variable "placeholder_email_domain" {
  description = "Domain used for synthetic emails when a social provider gives us none. Must never receive mail."
}
variable "ses_domain" {}
variable "ses_config_set_name" {}
variable "ses_email_identity_arn" {}

data "aws_caller_identity" "current" {}

locals {
  service_dependencies = ["logger", "shopify-admin-client", "secret-manager", "email"]
}

output "function_arn" {
  value = module.lambda.function_arn
}
