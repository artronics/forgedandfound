output "api_url" {
  value = "https://${local.api_domain}"
}

output "deployment_domain" {
  value = local.deployment_domain
}

output "cognito_user_pool_id" {
  value = data.terraform_remote_state.infra.outputs.cognito_user_pool_id
}

output "cognito_endpoint" {
  value = data.terraform_remote_state.infra.outputs.cognito_endpoint
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.app.id
}

output "cognito_client_secret" {
  value     = aws_cognito_user_pool_client.app.client_secret
  sensitive = true
}
