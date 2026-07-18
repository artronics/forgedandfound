variable "aws_account" {}
variable "aws_profile" {}
variable "region" {
  default = "eu-west-2"
}

variable "root_zone_name" {}
variable "prefix" {}

variable "ses_email_identity_arn" {}
variable "ses_email_identity" {}
variable "ses_email_domain" {}

variable "store_domains" {}

data "aws_caller_identity" "current" {}

locals {
  is_prod = var.aws_account == "prod"
}

output "cognito_endpoint" {
  value = "https://${local.cognito_domain}"
}

output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}