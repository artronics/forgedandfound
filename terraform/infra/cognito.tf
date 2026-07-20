# ---------------------------------------------------------------------------
# One user pool per AWS account. Per-deployment app clients live in platform.
# ---------------------------------------------------------------------------

locals {
  # Prod users sign in on the live env's subdomain (aliased to
  # account.forgedandfound.co.uk during the prod migration).
  cognito_domain  = local.is_prod ? "account.live.${local.account_zone_name}" : "account.${local.account_zone_name}"
  cognito_zone_id = local.is_prod ? aws_route53_zone.env["live"].zone_id : aws_route53_zone.account.zone_id

  # Shared secret pinned between the role trust policy and the Cognito
  # sms_configuration block, mitigating the confused-deputy problem.
  cognito_sns_external_id = "${local.prefix}-cognito-sns"
}

resource "aws_cognito_user_pool" "main" {
  name = "${local.prefix}-user-pool"

  depends_on = [terraform_data.ses_identity_verified]

  username_attributes      = ["email", "phone_number"]
  auto_verified_attributes = ["email", "phone_number"]

  mfa_configuration = "OFF"

  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = aws_sesv2_email_identity.account.arn
    from_email_address    = "${var.from_email}@${local.ses_domain}"
    configuration_set     = aws_sesv2_configuration_set.cognito.configuration_set_name
  }

  sms_configuration {
    external_id    = local.cognito_sns_external_id
    sns_caller_arn = aws_iam_role.cognito_sns.arn
    sns_region     = var.region
  }
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    sms_message          = "Your Forged & Found verification code is {####}"
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
      name     = "verified_phone_number"
      priority = 1
    }
    recovery_mechanism {
      name     = "verified_email"
      priority = 2
    }
  }

  lambda_config {
    custom_email_sender {
      lambda_arn     = module.auth_email_hook_handler.function_arn
      lambda_version = "V1_0"
    }
    kms_key_id        = aws_kms_key.cognito_email.arn
    post_confirmation = module.auth_shopify_customer_sync_handler.function_arn
    # PostConfirmation never fires for federated sign-ins; this creates the
    # Shopify customer for first-time social users instead.
    pre_sign_up = module.auth_shopify_customer_sync_handler.function_arn
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
  schema {
    name                = "accepts_marketing"
    attribute_data_type = "String"
    mutable             = true
    required            = false
    string_attribute_constraints {
      min_length = "0"
      max_length = "5"
    }
  }
}

# ---------------------------------------------------------------------------
# KMS – encrypts codes passed to the custom email sender Lambda
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "cognito_kms_key" {
  statement {
    sid    = "EnableRootAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "CognitoEncrypt"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cognito-idp.amazonaws.com"]
    }
    actions = [
      "kms:GenerateDataKey",
      "kms:Encrypt",
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_kms_key" "cognito_email" {
  description             = "Cognito custom email sender – code encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cognito_kms_key.json
}

resource "aws_kms_alias" "cognito_email" {
  name          = "alias/${local.prefix}-cognito-email"
  target_key_id = aws_kms_key.cognito_email.key_id
}

# ---------------------------------------------------------------------------
# Hosted UI custom domain
# ---------------------------------------------------------------------------

# CloudFront-backed (Cognito custom domain) — cert must be us-east-1.
module "cognito_domain_cert" {
  source = "../modules/cert"
  providers = {
    aws             = aws
    aws.cert_region = aws.us_east_1
  }

  domain_name = local.cognito_domain
  zone_id     = local.cognito_zone_id
}

resource "aws_cognito_user_pool_domain" "main" {
  domain                = local.cognito_domain
  user_pool_id          = aws_cognito_user_pool.main.id
  certificate_arn       = module.cognito_domain_cert.cert_arn
  managed_login_version = 2

  # Cognito validates that the parent domain resolves when the custom domain is created.
  depends_on = [aws_route53_record.account_zone_apex]
}

resource "aws_route53_record" "cognito_domain" {
  zone_id = local.cognito_zone_id
  name    = local.cognito_domain
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront hosted zone ID (global constant)
    evaluate_target_health = false
  }
}

# ---------------------------------------------------------------------------
# SMS via SNS
# ---------------------------------------------------------------------------

# Account-level SNS SMS settings (per region). Transactional gives OTP codes
# the highest delivery priority; the spend limit is a safety cap.
resource "aws_sns_sms_preferences" "main" {
  default_sms_type    = "Transactional"
  monthly_spend_limit = 1
  default_sender_id   = var.sms_sender_id
}

data "aws_iam_policy_document" "cognito_sns_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["cognito-idp.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [local.cognito_sns_external_id]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "cognito_sns" {
  name               = "${local.prefix}-cognito-sns"
  assume_role_policy = data.aws_iam_policy_document.cognito_sns_assume.json
}

# sns:Publish for SMS targets a phone number, not a topic ARN, so it cannot be
# resource-scoped; SMS text-message publishing is the only granted action.
data "aws_iam_policy_document" "cognito_sns" {
  statement {
    sid       = "CognitoSNSPublishSMS"
    effect    = "Allow"
    actions   = ["sns:Publish"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cognito_sns" {
  name   = "sns-publish-sms"
  role   = aws_iam_role.cognito_sns.id
  policy = data.aws_iam_policy_document.cognito_sns.json
}
