module "auth-email-hook-handler" {
  source = "./auth-email-hook-handler"
  prefix      = var.prefix
  aws_profile = var.aws_profile

  service_name              = "auth-email-hook-handler"
  app_url = format("https://%s.${var.root_zone_name}", var.store_domains[0])
  cognito_domain            = local.cognito_domain
  cognito_email_kms_key_arn = aws_kms_key.cognito_email_kms_key.arn
  cognito_user_pool_arn     = aws_cognito_user_pool.main.arn
  ses_config_set_name       = aws_sesv2_configuration_set.cognito.configuration_set_name
  ses_domain                = var.ses_email_domain
  ses_email_identity_arn    = var.ses_email_identity_arn
}

