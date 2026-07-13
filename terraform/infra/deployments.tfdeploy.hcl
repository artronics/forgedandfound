# Deployments of the infra Stack — ONE PER AWS ACCOUNT.
#
# Each deployment has its own isolated state and assumes a role in its target
# account via OIDC. The published outputs are consumed by the platform Stack
# (see platform/deployments.tfdeploy.hcl -> upstream_input "infra").

identity_token "aws" {
  audience = ["aws.workload.identity"]
}

deployment "nonprod" {
  inputs = {
    account   = "nonprod"
    region    = "eu-west-2"
    role_arn  = "arn:aws:iam::939103584423:role/TerraformDeployRole"
    aws_token = identity_token.aws.jwt
  }
}

deployment "prod" {
  inputs = {
    account   = "prod"
    region    = "eu-west-2"
    role_arn  = "arn:aws:iam::028607041427:role/TerraformDeployRole"
    aws_token = identity_token.aws.jwt
  }
}

# --- Published outputs, consumed by the platform Stack -----------------------

publish_output "nonprod_user_pool_id" {
  value = deployment.nonprod.cognito_user_pool_id
}
publish_output "nonprod_user_pool_arn" {
  value = deployment.nonprod.cognito_user_pool_arn
}
publish_output "nonprod_cognito_endpoint" {
  value = deployment.nonprod.cognito_endpoint
}

publish_output "prod_user_pool_id" {
  value = deployment.prod.cognito_user_pool_id
}
publish_output "prod_user_pool_arn" {
  value = deployment.prod.cognito_user_pool_arn
}
publish_output "prod_cognito_endpoint" {
  value = deployment.prod.cognito_endpoint
}
