variable "prefix" {}
variable "aws_profile" {}
variable "aws_account" {}
variable "region" {
  default = "eu-west-2"
}

variable "service_name" {}
variable "cognito_user_pool_arn" {}
variable "cognito_email_kms_key_arn" {}
variable "ses_domain" {}
variable "ses_config_set_name" {}
variable "ses_email_identity_arn" {}
variable "app_url" {}
variable "allowed_app_origins" {
  type        = list(string)
  description = "Storefront origins the email Lambda will honour from ClientMetadata when building verification/reset links."
}

data "aws_caller_identity" "current" {}

locals {
  service_dependencies = ["logger", "email"]
}

output "function_arn" {
  value = module.lambda.function_arn
}
