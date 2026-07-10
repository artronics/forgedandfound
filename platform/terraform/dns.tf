data "aws_route53_zone" "root_zone" {
  name = local.account_zone_name
}

locals {
  subdomains = {
    "store" : {
      cname = ["cf7020b26e3f4b48.vercel-dns-017.com."]
    }
  }
  store_domain = aws_route53_record.store_record.fqdn
}

resource "aws_route53_record" "store_record" {
  name    = "${var.environment}.store"
  zone_id = data.aws_route53_zone.root_zone.zone_id
  type    = "CNAME"
  ttl     = 300
  records = local.subdomains["store"]["cname"]
}
