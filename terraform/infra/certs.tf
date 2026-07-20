# ---------------------------------------------------------------------------
# Shared wildcard certificates, issued once here so platform deployments never
# wait on ACM issuance/validation (the slowest part of an ephemeral deploy).
#
# ACM wildcards cover exactly one label, which dictates the API domain scheme:
#   nonprod  api-<deployment>.nonprod.<root>   covered by *.nonprod.<root>
#   prod     api.<env>.prod.<root>             covered by *.<env>.prod.<root>
# ---------------------------------------------------------------------------

module "account_wildcard_cert" {
  source = "../modules/cert"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain_name = "*.${local.account_zone_name}"
  zone_id     = aws_route53_zone.account.zone_id
}

module "env_wildcard_cert" {
  for_each = local.is_prod ? toset(local.environments) : toset([])

  source = "../modules/cert"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain_name = "*.${each.key}.${local.account_zone_name}"
  zone_id     = aws_route53_zone.env[each.key].zone_id
}
