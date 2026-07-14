locals {
  root_zone_id = var.aws_account == "prod" ? "sdfd" : ""
}

#  Prod subdomains
resource "aws_route53_record" "shopify_cname" {
  count   = var.aws_account != "prod" ? 0 : 1
  zone_id = local.root_zone_id

  name    = "shopify"
  type    = "CNAME"
  ttl     = 300
  records = var.shopify_cname
}

resource "aws_route53_record" "vercel_cname" {
  count   = var.aws_account != "prod" ? 0 : 1
  zone_id = local.root_zone_id

  name    = "vercel"
  type    = "CNAME"
  ttl     = 300
  records = var.vercel_cname
}

locals {
  vercel_domains = ["development", "preview", "production"]
}

resource "aws_route53_record" "vercel_domains" {
  zone_id = local.root_zone_id
  count   = var.aws_account == "prod" ? length(local.vercel_domains) : 0

  name = local.vercel_domains[count.index]
  type = "CNAME"
  alias {
    evaluate_target_health = false
    name                   = local.vercel_domains[count.index]
    zone_id                = local.root_zone_id
  }
}

