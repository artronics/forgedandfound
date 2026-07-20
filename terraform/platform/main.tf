terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # bucket + key are supplied by `task tf:platform:init`
  # (bucket per account, one state per deployment under deployments/).
  backend "s3" {
    region       = "eu-west-2"
    encrypt      = true
    use_lockfile = true
  }
}

variable "aws_account" {
  type = string
  validation {
    condition     = contains(["nonprod", "prod"], var.aws_account)
    error_message = "AWS account must be either 'nonprod' or 'prod'"
  }
}

variable "deployment" {
  type = string
  validation {
    condition = var.aws_account == "prod" ? contains(["staging", "live"], var.deployment) : can(regex("^[a-z][a-z0-9-]{0,29}$", var.deployment))
    error_message = "Prod deployments must be 'staging' or 'live'; nonprod deployment names are lowercase alphanumeric/dash."
  }
  validation {
    # `development` is a reserved namespace, not a deployment: infra owns the
    # development.<account-zone> alias and any Vercel deployment can be wired
    # onto it. There are no platform resources behind it.
    condition     = var.deployment != "development"
    error_message = "'development' is a reserved namespace (DNS only, provisioned by infra) — deploy under your own name (e.g. pr-123) and alias it in Vercel."
  }
}

# See infra/main.tf — same guardrail.
variable "aws_account_ids" {
  type = map(string)
  default = {
    nonprod = "939103584423"
    prod    = "028607041427"
  }
}

variable "region" {
  type    = string
  default = "eu-west-2"
}

variable "root_domain" {
  type    = string
  default = "forgedandfound.co.uk"
}

variable "vercel_alias_target" {
  type        = list(string)
  default     = []
  description = "CNAME target for <deployment>.<account-zone>. preview uses its Vercel simple URL; PR deployments use Vercel's generic CNAME (cname.vercel-dns.com). Empty = no record."
}

variable "extra_app_urls" {
  type        = list(string)
  default     = []
  description = "Additional web-app origins for the Cognito client's callback/logout URLs (e.g. the Vercel simple URL)."
}

locals {
  is_prod = var.aws_account == "prod"

  # `preview` is the only deployment wired to the prv env; every other nonprod
  # deployment (including `development` and ephemerals) uses dev. Prod
  # deployments are their env.
  environment = local.is_prod ? var.deployment : (var.deployment == "preview" ? "prv" : "dev")

  namespace = "ff/platform/${var.aws_account}/${var.deployment}"
  prefix    = replace(local.namespace, "/", "-")

  account_zone_name = "${var.aws_account}.${var.root_domain}"

  # live.prod. / staging.prod. / <deployment>.nonprod.
  deployment_domain = "${var.deployment}.${local.account_zone_name}"

  # Names under a delegated env zone (prod: live./staging.) must be created in
  # that env zone — the parent won't resolve them past the NS delegation.
  # Nonprod deployment names sit directly under the account zone.
  dns_zone_id = local.is_prod ? data.terraform_remote_state.infra.outputs.env_zone_ids[local.environment] : data.terraform_remote_state.infra.outputs.account_zone_id
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.aws_account_ids[var.aws_account]]

  default_tags {
    tags = {
      project    = "forgedandfound"
      layer      = "platform"
      namespace  = local.namespace
      deployment = var.deployment
    }
  }
}

provider "aws" {
  alias               = "us_east_1"
  region              = "us-east-1"
  allowed_account_ids = [var.aws_account_ids[var.aws_account]]
}

data "aws_caller_identity" "current" {}

data "terraform_remote_state" "infra" {
  backend = "s3"

  config = {
    bucket = "artronics-ff-${var.aws_account}-infra-tf-state"
    key    = "infra.tfstate"
    region = var.region
  }
}
