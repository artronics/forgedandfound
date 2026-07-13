# ---------------------------------------------------------------------------
# Cognito – account-level user pool (one per AWS account).
#
# App CLIENTS are per-environment and live in the platform Stack
# (modules/cognito-client), created against this pool's id.
#
# This is a TRIMMED first-iteration version. Intentionally deferred to a later
# iteration (see infra/ auth.tf in the old layout for the full versions):
#   - custom email sender + post-confirmation Lambdas (lambda_config)
#   - KMS key for the custom email sender
#   - SMS delivery via an SNS IAM role (sms_configuration)
#   - social identity providers (Google / Apple / Facebook)
# ---------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "prefix" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "zone_name" {
  type        = string
  description = "Account zone FQDN, e.g. nonprod.forgedandfound.co.uk"
}

variable "ses_identity_arn" {
  type = string
}

variable "ses_configuration_set" {
  type = string
}

variable "ses_from_address" {
  type = string
}

locals {
  cognito_domain = "account.${var.zone_name}"
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.prefix}-user-pool"

  username_attributes = ["email", "phone_number"]
  auto_verified_attributes = ["email"]
  mfa_configuration = "OFF"

  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = var.ses_identity_arn
    from_email_address    = var.ses_from_address
    configuration_set     = var.ses_configuration_set
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "shopify_customer_id"
    attribute_data_type = "String"
    mutable             = true
    required            = false
    string_attribute_constraints {
      min_length = "0"
      max_length = "256"
    }
  }
}

module "cert" {
  source      = "../cert"
  domain_name = local.cognito_domain
  zone_id     = var.zone_id

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain                = local.cognito_domain
  user_pool_id          = aws_cognito_user_pool.main.id
  certificate_arn       = module.cert.cert_arn
  managed_login_version = 2
}

resource "aws_route53_record" "cognito_domain" {
  zone_id = var.zone_id
  name    = local.cognito_domain
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id = "Z2FDTNDATAQYW2" # CloudFront hosted zone id (global constant)
    evaluate_target_health = false
  }
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "endpoint" {
  value = "https://${local.cognito_domain}"
}
