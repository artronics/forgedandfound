module "email" {
  source         = "./email"
  region         = var.region
  aws_account    = var.aws_account
  root_zone_name = var.root_domain
  prefix         = local.prefix
}

locals {
  ses_email_identity     = module.email.ses_email_identity
  ses_email_identity_arn = module.email.ses_email_identity_arn
  ses_email_domain       = module.email.ses_email_domain
}
