# Providers for the platform Stack. Same OIDC pattern as infra; each
# deployment targets the account that hosts its environment.

required_providers {
  aws = {
    source  = "hashicorp/aws"
    version = "~> 6.0"
  }
}

provider "aws" "this" {
  config {
    region = var.region

    assume_role_with_web_identity {
      role_arn           = var.role_arn
      web_identity_token = var.aws_token
    }

    default_tags {
      tags = {
        project     = "forgedandfound"
        tier        = "platform"
        account     = var.account
        environment = var.environment
        namespace   = var.namespace
      }
    }
  }
}
