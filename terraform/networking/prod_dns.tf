locals {
  vercel_domains = ["development", "preview", "production", "www"]
  vercel_ip      = "216.150.1.1"
}

resource "aws_route53_record" "prod_root_zone_apex" {
  count   = local.is_prod ? 1 : 0
  zone_id = local.root_zone_id
  name    = local.root_zone_name
  type    = "A"
  ttl     = 300
  records = [local.vercel_ip]
}

#  Prod subdomains
resource "aws_route53_record" "vercel_domains" {
  count   = local.is_prod ? length(local.vercel_domains) : 0
  zone_id = local.root_zone_id

  name    = local.vercel_domains[count.index]
  type    = "CNAME"
  ttl     = 300
  records = var.vercel_cname
}

