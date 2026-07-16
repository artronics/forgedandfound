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

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

# App client (SECRET_HASH self-service calls: signUp / confirmSignUp) used by the
# account-service Lambda.
output "cognito_app_client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "cognito_app_client_secret" {
  value     = aws_cognito_user_pool_client.app.client_secret
  sensitive = true
}

# Machine-to-machine client the Next.js BFF uses to call the internal API.
output "m2m_client_id" {
  value = aws_cognito_user_pool_client.m2m.id
}

output "m2m_client_secret" {
  value     = aws_cognito_user_pool_client.m2m.client_secret
  sensitive = true
}