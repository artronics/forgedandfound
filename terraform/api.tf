module "api" {
  source      = "./api"
  aws_profile = var.aws_profile
  prefix      = local.prefix
  aws_account = var.aws_account
  region      = var.region
  root_domain = var.root_domain

  cognito_user_pool_arn         = module.auth.cognito_user_pool_arn
  user_service_invoke_arn       = module.user_service_lambda.invoke_arn
  user_service_function_name    = module.user_service_lambda.function_name
  account_service_invoke_arn    = module.account_service_lambda.invoke_arn
  account_service_function_name = module.account_service_lambda.function_name
}
