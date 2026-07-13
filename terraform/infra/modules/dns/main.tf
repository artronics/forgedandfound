# ---------------------------------------------------------------------------
# DNS – account-level zone (one per AWS account: nonprod / prod)
#
# The account zone (e.g. nonprod.forgedandfound.co.uk) is delegated from the
# root domain, which is managed in a separate DNS account. Here we only read
# it and lay down the account-wide records that per-environment resources
# depend on.
# ---------------------------------------------------------------------------

variable "zone_name" {
  type        = string
  description = "Account zone FQDN, e.g. nonprod.forgedandfound.co.uk"
}

data "aws_route53_zone" "account" {
  name = var.zone_name
}

# Cognito requires the parent domain to have a resolvable A record before it
# will accept a subdomain as a custom domain.
resource "aws_route53_record" "apex" {
  zone_id = data.aws_route53_zone.account.zone_id
  name    = data.aws_route53_zone.account.name
  type    = "A"
  ttl     = 300
  records = ["127.0.0.1"]
}

# Account-level Shopify storefront CNAME.
resource "aws_route53_record" "shopify" {
  zone_id = data.aws_route53_zone.account.zone_id
  name    = "shopify"
  type    = "CNAME"
  ttl     = 300
  records = ["shops.myshopify.com"]
}

output "zone_id" {
  value = data.aws_route53_zone.account.zone_id
}

output "zone_name" {
  value = data.aws_route53_zone.account.name
}
