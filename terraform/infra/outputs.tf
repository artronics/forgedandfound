# Consumed by platform via terraform_remote_state.

output "account_zone_id" {
  value = aws_route53_zone.account.zone_id
}
output "account_zone_name" {
  value = local.account_zone_name
}
output "env_zone_ids" {
  value = { for env, zone in aws_route53_zone.env : env => zone.zone_id }
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}
output "cognito_user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}
output "cognito_endpoint" {
  value = "https://${local.cognito_domain}"
}

output "ses_email_identity" {
  value = aws_sesv2_email_identity.account.email_identity
}
output "ses_email_identity_arn" {
  value = aws_sesv2_email_identity.account.arn
}
output "ses_email_domain" {
  value = local.ses_domain
}
output "ses_configuration_set" {
  value = aws_sesv2_configuration_set.cognito.configuration_set_name
}

output "ecr_repo_urls" {
  value = { for name, repo in aws_ecr_repository.service : name => repo.repository_url }
}

output "shopify_event_bus_name" {
  value = one(aws_cloudwatch_event_bus.shopify[*].name)
}
output "shopify_event_bus_arn" {
  value = one(aws_cloudwatch_event_bus.shopify[*].arn)
}
