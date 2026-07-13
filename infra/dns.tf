data "aws_route53_zone" "account_root_zone" {
  name = local.account_zone_name
}

locals {
  store_domains = aws_route53_record.vercel_env_cname[*].fqdn
  vercel_cname = ["cf7020b26e3f4b48.vercel-dns-017.com."]
  shopify_cname = ["shops.myshopify.com"]
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
  zone_id  = data.aws_route53_zone.account_root_zone.zone_id
  name     = "shopify"
  type     = "CNAME"
  ttl      = 300
  records  = local.shopify_cname
}

resource "aws_route53_record" "vercel_env_cname" {
  count = length(var.vercel_envs)
  zone_id  = data.aws_route53_zone.account_root_zone.zone_id
  name     = var.vercel_envs[count.index]
  type     = "CNAME"
  ttl      = 300
  records  = local.vercel_cname
}

