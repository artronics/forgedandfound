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
      type = "Service"
      identifiers = ["cognito-idp.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values = [local.cognito_sns_external_id]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_iam_role" "cognito_sns" {
  name               = "${var.prefix}-cognito-sns"
  assume_role_policy = data.aws_iam_policy_document.cognito_sns_assume.json
}

# sns:Publish for SMS targets a phone number, not a topic ARN, so it cannot be
# resource-scoped; SMS text-message publishing is the only granted action.
data "aws_iam_policy_document" "cognito_sns" {
  statement {
    sid    = "CognitoSNSPublishSMS"
    effect = "Allow"
    actions = ["sns:Publish"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "cognito_sns" {
  name   = "sns-publish-sms"
  role   = aws_iam_role.cognito_sns.id
  policy = data.aws_iam_policy_document.cognito_sns.json
}
