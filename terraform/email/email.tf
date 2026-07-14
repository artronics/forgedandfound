data "aws_route53_zone" "zone" {
  name = local.is_prod ? var.root_zone_name : "${var.aws_account}.${var.root_zone_name}"
}

locals {
  is_prod = var.aws_account == "prod"
  zone_id = data.aws_route53_zone.zone.zone_id
}

locals {
  # Domain used for email identities / From addresses
  ses_domain = data.aws_route53_zone.zone.name
  # MAIL FROM must always be a subdomain
  ses_mail_from = "mail.${local.ses_domain}"
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
  zone_id = local.zone_id
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
  zone_id = local.zone_id
  name    = local.ses_mail_from
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = local.zone_id
  name    = local.ses_mail_from
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "ses_dmarc" {
  zone_id = local.zone_id
  name    = "_dmarc.${local.ses_domain}"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${local.ses_domain}"]
}

