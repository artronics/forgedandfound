# The certificate's region is the caller's choice via the aws.cert_region
# provider: us-east-1 for CloudFront-backed consumers (Cognito hosted UI,
# edge API Gateway), the deployment region for regional API Gateway domains.
terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.cert_region]
    }
  }
}

variable "domain_name" {
  type = string
}
variable "zone_id" {
  type = string
}

resource "aws_acm_certificate" "cert" {
  provider = aws.cert_region
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Single-domain certificates only, so exactly one validation record — keyed
# statically, which keeps the whole module plannable before the certificate
# exists (a for_each over domain_validation_options is unknown at plan time).
locals {
  dvo = tolist(aws_acm_certificate.cert.domain_validation_options)[0]
}

resource "aws_route53_record" "cert_validation" {
  zone_id = var.zone_id
  name    = local.dvo.resource_record_name
  type    = local.dvo.resource_record_type
  ttl     = 60
  records = [local.dvo.resource_record_value]

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "cert_validation" {
  provider = aws.cert_region
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [aws_route53_record.cert_validation.fqdn]
}

output "cert_arn" {
  value = aws_acm_certificate_validation.cert_validation.certificate_arn
}
