locals {
  prefix    = "ff-infra-${var.account}"
  zone_name = "${var.account}.${var.root_domain}"
}

component "dns" {
  source = "./modules/dns"

  inputs = {
    zone_name = local.zone_name
  }

  providers = {
    aws = provider.aws.this
  }
}

component "ses" {
  source = "./modules/ses-identity"

  inputs = {
    prefix     = local.prefix
    region     = var.region
    zone_id    = component.dns.zone_id
    ses_domain = local.zone_name
  }

  providers = {
    aws = provider.aws.this
  }
}

component "cognito" {
  source = "./modules/cognito-pool"

  inputs = {
    prefix                = local.prefix
    zone_id               = component.dns.zone_id
    zone_name             = local.zone_name
    ses_identity_arn      = component.ses.identity_arn
    ses_configuration_set = component.ses.configuration_set_name
    ses_from_address      = component.ses.sender_address
  }

  providers = {
    aws           = provider.aws.this
    aws.us_east_1 = provider.aws.us_east_1
  }
}
