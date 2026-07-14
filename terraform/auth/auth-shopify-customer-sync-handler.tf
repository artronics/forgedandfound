module "auth-shopify-customer-sync-handler" {
  source      = "./auth-shopify-customer-sync-handler"
  prefix      = var.prefix
  aws_profile = var.aws_profile

  cognito_user_pool_arn = aws_cognito_user_pool.main.arn
}
