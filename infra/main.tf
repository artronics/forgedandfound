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

variable "aws_profile" {
  default = ""
}
variable "region" {
  default = "eu-west-2"
}
variable "root_domain" {
  default = "forgedandfound.co.uk"
}
variable "shopify_app_id" {
  type = string
  description = "Shopify APP ID or client id"
}
variable "vercel_envs" {
  type = list(string)
  default = ["development","preview", "production"]
}

locals {
  app_url = var.aws_account == "prod" ? "https://${var.root_domain}" : "https://${var.aws_account}.${var.root_domain}"
}

locals {
  account_zone_name = "${var.aws_account}.${var.root_domain}"
  project           = "forgedandfound"
  tier              = "infra"
  prefix            = "${local.project}-${local.tier}-${var.aws_account}"
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

