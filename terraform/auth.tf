module "auth" {
  source      = "./auth"
  aws_account = var.aws_account
  aws_profile = var.aws_profile
  prefix      = local.prefix

  root_zone_name         = var.root_domain
  ses_email_identity_arn = local.ses_email_identity_arn
  ses_email_domain       = local.ses_email_domain
  ses_email_identity     = local.ses_email_identity
}

locals {
  cognito_user_pool_arn = module.auth.cognito_user_pool_arn
}
