data "aws_route53_zone" "zone" {
  name = var.aws_account == "prod" ? var.root_zone_name : "${var.aws_account}.${var.root_zone_name}"
}
locals {
  cognito_domain = "account.${data.aws_route53_zone.zone.name}"
}

module "cognito_domain_cert" {
  source      = "./../cert"
  domain_name = local.cognito_domain
  zone_id     = data.aws_route53_zone.zone.zone_id
}
resource "aws_cognito_user_pool_domain" "main" {
  domain                = local.cognito_domain
  user_pool_id          = aws_cognito_user_pool.main.id
  certificate_arn       = module.cognito_domain_cert.cert_arn
  managed_login_version = 2
}

resource "aws_route53_record" "cognito_domain" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = local.cognito_domain
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id = "Z2FDTNDATAQYW2" # CloudFront hosted zone ID (global constant)
    evaluate_target_health = false
  }
}
