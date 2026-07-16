module "auth-shopify-customer-sync-handler" {
  source      = "./auth-shopify-customer-sync-handler"
  prefix      = var.prefix
  aws_account = var.aws_account
  aws_profile = var.aws_profile

  service_name          = "auth-shopify-customer-sync-handler"
  cognito_user_pool_arn = aws_cognito_user_pool.main.arn
  # A subdomain we never configure for mail, so these addresses can't be
  # delivered to even by accident.
  placeholder_email_domain = "no-reply.${var.root_zone_name}"
}
