data "aws_route53_zone" "account_root_zone" {
  name = local.account_zone_name
}

locals {
  subdomains = {
    "shopify": {
      cname   = [ "shops.myshopify.com."]
    }
    "store": {
      cname   = [ "cf7020b26e3f4b48.vercel-dns-017.com." ]
    }
  }
}


# Cognito requires the parent domain to have a resolvable A record before
# it will accept a subdomain as a custom domain.
resource "aws_route53_record" "account_zone_apex" {
  zone_id = data.aws_route53_zone.account_root_zone.zone_id
  name    = data.aws_route53_zone.account_root_zone.name
  type    = "A"
  ttl     = 300
  records = ["127.0.0.1"]
}

resource "aws_route53_record" "shopify_cname" {
  for_each = local.subdomains
  zone_id  = data.aws_route53_zone.account_root_zone.zone_id
  name     = each.key
  type     = "CNAME"
  ttl      = 300
  records  = each.value["cname"]
}
