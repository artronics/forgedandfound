# ---------------------------------------------------------------------------
# SES sending identity, one per account.
#
# prod: the identity is the ROOT domain — users receive mail from
# <x>@forgedandfound.co.uk. This coexists with Google Workspace (Google keeps
# the MX / receiving side; SES only sends): the apex SPF merges both includes,
# and the Google-owned records (apex MX, google._domainkey) are never defined
# here. Any pre-existing SES records in the root zone are removed out-of-band
# before the prod migration so terraform owns its own.
#
# nonprod: the identity is the account zone (nonprod.forgedandfound.co.uk).
# ---------------------------------------------------------------------------

data "aws_route53_zone" "root" {
  count = local.is_prod ? 1 : 0
  name  = var.root_domain
}

locals {
  ses_domain  = local.is_prod ? var.root_domain : local.account_zone_name
  ses_zone_id = local.is_prod ? data.aws_route53_zone.root[0].zone_id : aws_route53_zone.account.zone_id

  # SES MAIL FROM must be a subdomain of the identity.
  ses_mail_from = "mail.${local.ses_domain}"

  # prod shares the SPF record with Google Workspace.
  ses_spf = local.is_prod ? "v=spf1 include:_spf.google.com include:amazonses.com ~all" : "v=spf1 include:amazonses.com ~all"
}

resource "aws_sesv2_email_identity" "account" {
  email_identity = local.ses_domain

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = local.ses_zone_id

  name = "${aws_sesv2_email_identity.account.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${local.ses_domain}"
  type = "CNAME"
  ttl  = 300

  records = [
    "${aws_sesv2_email_identity.account.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"
  ]
}

resource "aws_route53_record" "ses_spf" {
  zone_id = local.ses_zone_id
  name    = local.ses_domain
  type    = "TXT"
  ttl     = 300

  # The prod root zone already has a TXT at the apex (Google site
  # verification + SPF).
  allow_overwrite = true

  records = [local.ses_spf]
}

resource "aws_sesv2_email_identity_mail_from_attributes" "account" {
  email_identity         = aws_sesv2_email_identity.account.email_identity
  mail_from_domain       = local.ses_mail_from
  behavior_on_mx_failure = "REJECT_MESSAGE"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = local.ses_zone_id
  name    = local.ses_mail_from
  type    = "MX"
  ttl     = 300

  records = [
    "10 feedback-smtp.${var.region}.amazonses.com"
  ]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = local.ses_zone_id
  name    = local.ses_mail_from
  type    = "TXT"
  ttl     = 300

  records = [
    "v=spf1 include:amazonses.com -all"
  ]
}

resource "aws_route53_record" "ses_dmarc" {
  zone_id = local.ses_zone_id
  name    = "_dmarc.${local.ses_domain}"
  type    = "TXT"
  ttl     = 300

  allow_overwrite = true

  records = [
    "v=DMARC1; p=quarantine; adkim=s; aspf=s; rua=mailto:dmarc-reports@${local.ses_domain}"
  ]
}

# Cognito refuses to create a pool wired to an unverified SES identity, and
# DKIM verification only completes once SES observes the published DNS records
# — wait for it so a fresh account bootstraps in a single apply.
resource "terraform_data" "ses_identity_verified" {
  triggers_replace = aws_sesv2_email_identity.account.arn

  provisioner "local-exec" {
    command = <<-EOT
      for i in $(seq 1 60); do
        status=$(aws sesv2 get-email-identity --region ${var.region} \
          --email-identity ${local.ses_domain} \
          --query 'VerifiedForSendingStatus' --output text)
        [ "$status" = "True" ] && exit 0
        echo "waiting for SES identity ${local.ses_domain} verification ($status)..."
        sleep 10
      done
      echo "SES identity ${local.ses_domain} not verified after 10m" >&2
      exit 1
    EOT
  }

  depends_on = [aws_route53_record.ses_dkim]
}

# ---------------------------------------------------------------------------
# Cognito -> SES wiring: identity policy + configuration set.
# ---------------------------------------------------------------------------

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

resource "aws_sesv2_email_identity_policy" "cognito" {
  email_identity = aws_sesv2_email_identity.account.email_identity
  policy_name    = "${local.prefix}-cognito-send"
  policy         = data.aws_iam_policy_document.cognito_ses.json
}

resource "aws_sesv2_configuration_set" "cognito" {
  configuration_set_name = "${local.prefix}-cognito-email"

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}
