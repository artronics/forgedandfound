# ---------------------------------------------------------------------------
# SES – account-level email identity (one per AWS account)
#
# nonprod : no-reply@nonprod.forgedandfound.co.uk
# prod    : no-reply@prod.forgedandfound.co.uk
# ---------------------------------------------------------------------------

variable "prefix" {
  type        = string
  description = "Resource naming prefix, e.g. ff-infra-nonprod"
}

variable "region" {
  type = string
}

variable "zone_id" {
  type        = string
  description = "Route53 zone id of the account zone"
}

variable "ses_domain" {
  type        = string
  description = "Sending domain, e.g. nonprod.forgedandfound.co.uk"
}

locals {
  ses_mail_from = "mail.${var.ses_domain}"
}

resource "aws_sesv2_email_identity" "account" {
  email_identity = var.ses_domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# Easy DKIM – 3 CNAME records
resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.account.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.ses_domain}"
  type    = "CNAME"
  ttl     = 300
  records = ["${aws_sesv2_email_identity.account.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# Custom MAIL FROM subdomain (SPF alignment)
resource "aws_sesv2_email_identity_mail_from_attributes" "account" {
  email_identity         = aws_sesv2_email_identity.account.email_identity
  mail_from_domain       = local.ses_mail_from
  behavior_on_mx_failure = "REJECT_MESSAGE"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = var.zone_id
  name    = local.ses_mail_from
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = var.zone_id
  name    = local.ses_mail_from
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.ses_domain}"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${var.ses_domain}"]
}

resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = "${var.prefix}-email"

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

# Allow Cognito to send via this identity.
data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "cognito_ses" {
  statement {
    sid    = "CognitoSESSend"
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = ["email.cognito-idp.amazonaws.com"]
    }
    actions = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [aws_sesv2_email_identity.account.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values = [data.aws_caller_identity.current.account_id]
    }
  }
}

resource "aws_sesv2_email_identity_policy" "cognito" {
  email_identity = aws_sesv2_email_identity.account.email_identity
  policy_name    = "cognito-send"
  policy         = data.aws_iam_policy_document.cognito_ses.json
}

output "identity_arn" {
  value = aws_sesv2_email_identity.account.arn
}

output "configuration_set_name" {
  value = aws_sesv2_configuration_set.main.configuration_set_name
}

output "sender_address" {
  value = "no-reply@${var.ses_domain}"
}
