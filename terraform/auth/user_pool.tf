locals {
  # Shared secret pinned between the role trust policy and the Cognito
  # sms_configuration block, mitigating the confused-deputy problem.
  cognito_sns_external_id = "${var.prefix}-cognito-sns"
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.prefix}-user-pool"

  username_attributes      = ["email", "phone_number"]
  auto_verified_attributes = ["email", "phone_number"]

  # Keep the current email active until the new one is verified. Without this,
  # UpdateUserAttributes swaps the address immediately (unverified), which can
  # lock the user out of email sign-in and puts unproven addresses on record.
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  mfa_configuration = "OFF"

  email_configuration {
    email_sending_account = "DEVELOPER"
    source_arn            = var.ses_email_identity_arn
    from_email_address    = "no-reply@${var.ses_email_domain}"
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
      lambda_arn     = module.auth-email-hook-handler.function_arn
      lambda_version = "V1_0"
    }
    kms_key_id        = aws_kms_key.cognito_email_kms_key.arn
    post_confirmation = module.auth-shopify-customer-sync-handler.function_arn
    # Links an incoming social identity into an existing native account, before
    # Cognito creates a duplicate federated user.
    pre_sign_up = module.auth-shopify-customer-sync-handler.function_arn
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
  # "true" when the email is a synthetic stand-in (a provider gave us none) or an
  # Apple relay — i.e. not a real address the user owns. Drives whether the UI
  # shows an email and asks for one. Flagged explicitly rather than pattern
  # matching the address.
  schema {
    name                = "email_placeholder"
    attribute_data_type = "String"
    mutable             = true
    required            = false
    string_attribute_constraints {
      min_length = "0"
      max_length = "8"
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

resource "aws_kms_key" "cognito_email_kms_key" {
  description             = "Cognito custom email sender – code encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.cognito_kms_key.json
}

resource "aws_kms_alias" "cognito_email" {
  name          = "alias/${var.prefix}-cognito-email"
  target_key_id = aws_kms_key.cognito_email_kms_key.key_id
}
