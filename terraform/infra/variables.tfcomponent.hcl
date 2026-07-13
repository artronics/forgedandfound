# Inputs for the infra Stack. Values are supplied per-deployment in
# deployments.tfdeploy.hcl (one deployment per AWS account).

variable "account" {
  type        = string
  description = "AWS account name: nonprod | prod"
}

variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "root_domain" {
  type    = string
  default = "forgedandfound.co.uk"
}

variable "role_arn" {
  type        = string
  description = "IAM role in the target account that the Stack assumes via OIDC"
}

variable "aws_token" {
  type        = string
  description = "OIDC JWT minted by the deployment (identity_token.aws.jwt)"
  ephemeral   = true
}
