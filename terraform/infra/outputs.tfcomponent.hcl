# Stack-level outputs. These are surfaced per-deployment and then re-exported
# for the platform Stack via publish_output in deployments.tfdeploy.hcl.

output "cognito_user_pool_id" {
  type  = string
  value = component.cognito.user_pool_id
}

output "cognito_user_pool_arn" {
  type  = string
  value = component.cognito.user_pool_arn
}

output "cognito_endpoint" {
  type  = string
  value = component.cognito.endpoint
}

output "account_zone_id" {
  type  = string
  value = component.dns.zone_id
}
