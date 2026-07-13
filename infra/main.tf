terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    region  = "eu-west-2"
    encrypt = true
  }
}

variable "aws_account" {
  type    = string
  default = "nonprod"
  validation {
    condition = contains(["nonprod", "prod"], var.aws_account)
    error_message = "AWS account must be either 'nonprod' or 'prod'"
  }
}
variable "deployment_env" {
  type    = string
  default = "development"
  validation {
    condition = contains(var.aws_account == "prod" ? ["staging", "production"] :
      ["development", "preview"], var.deployment_env)
    error_message = "Deployment environment must be one of 'development', 'preview', 'staging' or 'production'."
  }
}

variable "aws_profile" {
  default = ""
}
variable "region" {
  default = "eu-west-2"
}
variable "root_domain" {
  default = "forgedandfound.co.uk"
}
locals {
  app_url = var.aws_account == "prod" ? "https://${var.root_domain}" : "https://${var.aws_account}.${var.root_domain}"
}

locals {
  account_zone_name = "${var.aws_account}.${var.root_domain}"
  prefix = "ff-infra-${var.deployment_env}"
}


provider "aws" {
  region  = var.region
  profile = var.aws_profile != "" ? var.aws_profile : null
  default_tags {
    tags = {
      project = "forgedandfound"
      tier    = "infra"
    }
  }
}
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null
}

