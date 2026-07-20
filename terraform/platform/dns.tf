# Convention-first naming with a simpler alias on top:
#   <deployment>.nonprod.forgedandfound.co.uk -> <deployment>.forgedandfound.co.uk -> vercel
# The simple URL already exists in the prod root zone (development., preview.)
# pointing at Vercel; here we only create the conventional name. Ephemeral
# deployments have no Vercel project domain, so this is opt-in via tfvars.
resource "aws_route53_record" "vercel_alias" {
  count = var.vercel_alias ? 1 : 0

  zone_id = local.dns_zone_id
  name    = local.deployment_domain
  type    = "CNAME"
  ttl     = 300
  records = ["${var.deployment}.${var.root_domain}"]
}
