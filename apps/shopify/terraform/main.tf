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

variable "environment" {
  default = "dev"
  validation {
    condition = contains(["dev", "live"], var.environment)
    error_message = "environment must be 'dev'"
  }
}

variable "region" {
  default = "eu-west-2"
}
variable "root_domain" {
  default = "forgedandfound.co.uk"
}

locals {
  account_zone_name = "${var.aws_account}.${var.root_domain}"

  project           = "forgedandfound-app"
  tier              = "backend"
  prefix            = "${local.project}-${local.tier}-${var.environment}"
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile != "" ? var.aws_profile : null
  default_tags {
    tags = {
      project = "forgedandfound-app"
      tier    = "backend"
    }
  }
}
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile != "" ? var.aws_profile : null
}

