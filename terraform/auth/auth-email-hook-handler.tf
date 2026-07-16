module "auth-email-hook-handler" {
  source      = "./auth-email-hook-handler"
  prefix      = var.prefix
  aws_account = var.aws_account
  aws_profile = var.aws_profile

  service_name              = "auth-email-hook-handler"
  app_url                   = local.is_prod ? "https://${var.root_zone_name}" : format("https://%s", var.store_domains[0])
  allowed_app_origins       = local.app_urls
  cognito_email_kms_key_arn = aws_kms_key.cognito_email_kms_key.arn
  cognito_user_pool_arn     = aws_cognito_user_pool.main.arn
  ses_config_set_name       = aws_sesv2_configuration_set.cognito.configuration_set_name
  ses_domain                = var.ses_email_domain
  ses_email_identity_arn    = var.ses_email_identity_arn
}

