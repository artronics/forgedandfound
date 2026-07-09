# ---------------------------------------------------------------------------
# SES – account-level email identity
#
# nonprod : no-reply@nonprod.forgedandfound.co.uk
# prod    : no-reply@prod.forgedandfound.co.uk
#
# Root domain (forgedandfound.co.uk) is managed in a separate DNS account.
# SES for the root domain should be set up in that account's Terraform.
# ---------------------------------------------------------------------------

locals {
  ses_domain    = local.account_zone_name           # nonprod.forgedandfound.co.uk / prod.forgedandfound.co.uk
  ses_mail_from = "mail.${local.account_zone_name}"
}

resource "aws_sesv2_email_identity" "account" {
  email_identity = local.ses_domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

# Easy DKIM – 3 CNAME records
resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.account_root_zone.zone_id
  name    = "${aws_sesv2_email_identity.account.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.ses_domain}"
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

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = data.aws_route53_zone.account_root_zone.zone_id
  name    = local.ses_mail_from
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = data.aws_route53_zone.account_root_zone.zone_id
  name    = local.ses_mail_from
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "ses_dmarc" {
  zone_id = data.aws_route53_zone.account_root_zone.zone_id
  name    = "_dmarc.${local.ses_domain}"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${local.ses_domain}"]
}

# Configuration set
resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = "${local.prefix}-email"

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

# IAM – allow Cognito to send email via this SES identity
data "aws_iam_policy_document" "cognito_ses" {
  statement {
    sid    = "CognitoSESSend"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["email.cognito-idp.amazonaws.com"]
    }
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [aws_sesv2_email_identity.account.arn]
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_sesv2_email_identity_policy" "cognito" {
  email_identity = aws_sesv2_email_identity.account.email_identity
  policy_name    = "cognito-send"
  policy         = data.aws_iam_policy_document.cognito_ses.json
}

# ---------------------------------------------------------------------------
# Outputs – consumed by per-app Terraform
# ---------------------------------------------------------------------------

output "ses_identity_arn" {
  value = aws_sesv2_email_identity.account.arn
}

output "ses_configuration_set_name" {
  value = aws_sesv2_configuration_set.main.configuration_set_name
}

output "ses_sender_address" {
  value = "no-reply@${local.ses_domain}"
}
