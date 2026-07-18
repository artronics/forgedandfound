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
    condition     = contains(["nonprod", "prod"], var.aws_account)
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

variable "store_nonprod_subdomains" {
  default = ["preview", "development"]
}

locals {
  deployment_env = var.aws_account == "prod" ? "live" : "dev"
  prefix         = "ff-${var.aws_account}-${local.deployment_env}"
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile != "" ? var.aws_profile : null
  default_tags {
    tags = {
      project = "forgedandfound"
      env     = local.deployment_env
    }
  }
}
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null
}

