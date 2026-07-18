# IAM – allow Cognito to send email via this SES identity
data "aws_iam_policy_document" "cognito_ses" {
  statement {
    sid    = "CognitoSESSend"
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = ["email.cognito-idp.amazonaws.com"]
    }
    actions = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [var.ses_email_identity_arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sesv2_email_identity_policy" "cognito" {
  email_identity = var.ses_email_identity
  policy_name    = "${var.prefix}-cognito-send"
  policy         = data.aws_iam_policy_document.cognito_ses.json
}

resource "aws_sesv2_configuration_set" "cognito" {
  configuration_set_name = "${var.prefix}-cognito-email"

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}
