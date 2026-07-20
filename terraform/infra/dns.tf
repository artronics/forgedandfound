# ---------------------------------------------------------------------------
# Zones.
#
#   root (prod account, NOT managed here)      forgedandfound.co.uk
#     └─ account zone (managed, imported)      <account>.forgedandfound.co.uk
#          └─ env zones (managed)              <env>.<account>.forgedandfound.co.uk
#
# The root zone already delegates NS to both account zones, so nothing in the
# prod account needs to change to operate nonprod.
# ---------------------------------------------------------------------------

resource "aws_route53_zone" "account" {
  name = local.account_zone_name
}

resource "aws_route53_zone" "env" {
  for_each = toset(local.environments)

  name = "${each.key}.${local.account_zone_name}"
}

resource "aws_route53_record" "env_delegation" {
  for_each = toset(local.environments)

  zone_id = aws_route53_zone.account.zone_id
  name    = aws_route53_zone.env[each.key].name
  type    = "NS"
  ttl     = 172800
  records = aws_route53_zone.env[each.key].name_servers
}

# Cognito requires the parent domain of a custom domain to have a resolvable A
# record. The prod root zone has a real apex; the nonprod account zone gets a
# placeholder.
resource "aws_route53_record" "account_zone_apex" {
  count = local.is_prod ? 0 : 1

  zone_id = aws_route53_zone.account.zone_id
  name    = local.account_zone_name
  type    = "A"
  ttl     = 300
  records = ["127.0.0.1"]
}

# ---------------------------------------------------------------------------
# Shopify. Shopify has exactly two deployments (prod/nonprod), so these are
# account-level names, not per-environment. Convention-first chain:
#   shop.<account-zone> -> shop.forgedandfound.co.uk -> shopify
# ---------------------------------------------------------------------------

resource "aws_route53_record" "shopify_shop" {
  zone_id = aws_route53_zone.account.zone_id
  name    = "shop.${local.account_zone_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.shopify_shop_domain]
}

resource "aws_route53_record" "shopify_customer" {
  zone_id = aws_route53_zone.account.zone_id
  name    = "customer.${local.account_zone_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.shopify_customer_domain]
}

# ---------------------------------------------------------------------------
# Reserved deployment names (nonprod). NOT platform deployments — no resources
# behind them, just the conventional name aliased to its Vercel simple URL so
# any Vercel deployment (a local run, a pr-123 platform env) can be wired to
# e.g. development.forgedandfound.co.uk.
# ---------------------------------------------------------------------------

resource "aws_route53_record" "reserved_deployment" {
  for_each = local.is_prod ? toset([]) : toset(var.reserved_deployment_domains)

  zone_id = aws_route53_zone.account.zone_id
  name    = "${each.key}.${local.account_zone_name}"
  type    = "CNAME"
  ttl     = 300
  records = ["${each.key}.${var.root_domain}"]
}

# ---------------------------------------------------------------------------
# Root zone records (prod account only). Terraform owns everything Vercel- and
# Shopify-related in the root zone; the Google Workspace records (apex MX,
# google._domainkey, etc.) are never defined here and never touched.
# ---------------------------------------------------------------------------

resource "aws_route53_record" "root_apex" {
  count = local.is_prod ? 1 : 0

  zone_id = data.aws_route53_zone.root[0].zone_id
  name    = var.root_domain
  type    = "A"
  ttl     = 300
  records = [var.vercel_ip]
}

resource "aws_route53_record" "root_vercel" {
  for_each = local.is_prod ? toset(var.vercel_domains) : toset([])

  zone_id = data.aws_route53_zone.root[0].zone_id
  name    = "${each.key}.${var.root_domain}"
  type    = "CNAME"
  ttl     = 300
  records = var.vercel_cname
}

resource "aws_route53_record" "root_shopify" {
  for_each = local.is_prod ? {
    shop     = var.shopify_shop_domain
    customer = var.shopify_customer_domain
  } : {}

  zone_id = data.aws_route53_zone.root[0].zone_id
  name    = each.value
  type    = "CNAME"
  ttl     = 300
  records = var.shopify_cname
}
