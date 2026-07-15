locals {
  # Shared secret pinned between the role trust policy and the Cognito
  # sms_configuration block, mitigating the confused-deputy problem.
  cognito_sns_external_id = "${var.prefix}-cognito-sns"
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.prefix}-user-pool"

  username_attributes = ["email", "phone_number"]
  auto_verified_attributes = ["email", "phone_number"]

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
      lambda_arn     = module.custom-email-sender-lambda.function_arn
      lambda_version = "V1_0"
    }
    kms_key_id = aws_kms_key.cognito_email.arn
    post_confirmation = module.auth-shopify-customer-sync-handler.function_arn
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
# ---------------------------------------------------------------------------
# KMS – encrypts codes passed to the custom email sender Lambda
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "cognito_kms_key" {
  statement {
    sid    = "EnableRootAccess"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "CognitoEncrypt"
    effect = "Allow"
    principals {
      type = "Service"
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
      values = [data.aws_caller_identity.current.account_id]
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
  name          = "alias/${var.prefix}-cognito-email"
  target_key_id = aws_kms_key.cognito_email.key_id
}
