data "aws_route53_zone" "account_zone" {
  name = "${var.aws_account}.${var.root_domain}"
}

# Cognito requires the parent domain to have a resolvable A record before
# it will accept a subdomain as a custom domain.
resource "aws_route53_record" "account_zone_apex" {
  zone_id = data.aws_route53_zone.account_zone.zone_id
  name    = data.aws_route53_zone.account_zone.name
  type    = "A"
  ttl     = 300
  records = ["127.0.0.1"]
}

