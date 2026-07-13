# ---------------------------------------------------------------------------
# ACM certificate (DNS-validated).
#
# Certificates for CloudFront-fronted services (like the Cognito managed login
# domain) MUST live in us-east-1, so this module takes an aliased us_east_1
# provider. In a Stack, modules cannot configure their own providers — the
# provider is passed in from the component (see components.tfcomponent.hcl).
# ---------------------------------------------------------------------------

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "domain_name" {
  type = string
}

variable "zone_id" {
  type        = string
  description = "Route53 zone used to publish DNS validation records"
}

resource "aws_acm_certificate" "cert" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  # Validation records live in the account zone (default/regional provider).
  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "cert" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}

output "cert_arn" {
  value = aws_acm_certificate_validation.cert.certificate_arn
}
