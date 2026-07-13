# Providers for the infra Stack.
#
# In a Stack, providers are configured here (not inside modules) and passed to
# each component. AWS auth uses OIDC: the deployment mints a short-lived JWT
# (identity_token) that is exchanged for the target account's role.

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
        project = "forgedandfound"
        tier    = "infra"
        account = var.account
      }
    }
  }
}

# CloudFront-fronted certs (Cognito managed login) must be issued in us-east-1.
provider "aws" "us_east_1" {
  config {
    region = "us-east-1"

    assume_role_with_web_identity {
      role_arn           = var.role_arn
      web_identity_token = var.aws_token
    }

    default_tags {
      tags = {
        project = "forgedandfound"
        tier    = "infra"
        account = var.account
      }
    }
  }
}
