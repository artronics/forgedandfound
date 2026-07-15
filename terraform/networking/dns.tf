# Cognito requires the parent domain to have a resolvable A record before
# it will accept a subdomain as a custom domain.
resource "aws_route53_record" "account_zone_apex" {
  count   = local.is_prod ? 0 : 1
  zone_id = local.root_zone_id
  name    = local.root_zone_name
  type    = "A"
  ttl     = 300
  records = ["127.0.0.1"]
}
