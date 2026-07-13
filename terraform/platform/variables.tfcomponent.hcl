variable "account" {
  type        = string
  description = "AWS account hosting this environment: nonprod | prod"
}

variable "environment" {
  type        = string
  description = "Logical environment: development | preview | staging | production"
}

variable "namespace" {
  type        = string
  description = <<-EOT
    Naming prefix segment that makes every resource unique within its account.
    Normally equal to the environment (e.g. "development"). For ephemeral,
    per-user or per-PR environments, override it (e.g. "pr-123", "dev-alice")
    so a developer can deploy and destroy an isolated stack of resources.
  EOT
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

variable "shopify_app_id" {
  type = string
}

variable "cognito_user_pool_id" {
  type = string
}

variable "app_urls" {
  type = list(string)
  description = "Base app URLs for this environment (callback/logout are derived)"
}
