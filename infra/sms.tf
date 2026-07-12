# ---------------------------------------------------------------------------
# SMS – account-level SMS delivery for Cognito (via Amazon SNS)
#
# Cognito delivers verification / recovery codes as text messages by calling
# Amazon SNS. It assumes the role below (scoped by an external id + source
# account) to run sns:Publish against a bare phone number.
#
# SMS is the preferred channel: users with a verified phone number receive
# codes by text, falling back to email only when no phone is available
# (see auth.tf – username_attributes + account_recovery_setting).
# ---------------------------------------------------------------------------

locals {
  # Shared secret pinned between the role trust policy and the Cognito
  # sms_configuration block, mitigating the confused-deputy problem.
  cognito_sns_external_id = "${local.prefix}-cognito-sns"
}

# Account-level SNS SMS settings (per region). Transactional gives OTP codes
# the highest delivery priority; the spend limit is a safety cap.
resource "aws_sns_sms_preferences" "main" {
  default_sms_type    = "Transactional"
  monthly_spend_limit = 1
  default_sender_id   = "FandF" # alphanumeric sender id (UK/EU; ignored by US/CA carriers)
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
