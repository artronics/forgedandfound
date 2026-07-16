module "auth-shopify-customer-sync-handler" {
  source      = "./auth-shopify-customer-sync-handler"
  prefix      = var.prefix
  aws_account = var.aws_account
  aws_profile = var.aws_profile

  service_name          = "auth-shopify-customer-sync-handler"
  cognito_user_pool_arn = aws_cognito_user_pool.main.arn
}
