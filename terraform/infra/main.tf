terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # bucket + key are supplied by `task tf:infra:init` (per-account bucket).
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

# Applying with credentials for the wrong account fails before touching
# anything (allowed_account_ids below).
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

variable "shopify_app_id" {
  type        = string
  default     = ""
  description = "Shopify app id for the EventBridge partner event source. Empty = no event bus."
}

# --- DNS targets -------------------------------------------------------------

variable "vercel_cname" {
  type        = list(string)
  default     = ["c99284151c832333.vercel-dns-016.com"]
  description = "Vercel CNAME target for the simple URLs in the root zone."
}

variable "vercel_ip" {
  type        = string
  default     = "216.150.1.1"
  description = "Vercel apex A record target (root domain, prod only)."
}

variable "vercel_domains" {
  type        = list(string)
  default     = ["development", "preview", "production", "www"]
  description = "Simple URLs in the root zone pointing at Vercel (prod only)."
}

variable "reserved_deployment_domains" {
  type        = list(string)
  default     = ["development"]
  description = "Reserved names in the nonprod account zone, aliased to their Vercel simple URL. Not platform deployments — any Vercel deployment can be aliased onto them."
}

variable "shopify_shop_domain" {
  type        = string
  default     = "shop.forgedandfound.co.uk"
  description = "Simple URL for the Shopify storefront. Root-zone record (prod) and CNAME target of shop.<account-zone>."
}

variable "shopify_customer_domain" {
  type        = string
  default     = "customer.forgedandfound.co.uk"
  description = "Simple URL for Shopify customer accounts. Root-zone record (prod) and CNAME target of customer.<account-zone>."
}

variable "shopify_cname" {
  type        = list(string)
  default     = ["shops.myshopify.com"]
  description = "Shopify CNAME target for the simple shop/customer URLs."
}

# --- Email / SMS / secrets ---------------------------------------------------

variable "from_email" {
  type        = string
  default     = "no-reply"
  description = "Local part of the SES from-address (no-reply@<ses-domain>)."
}

variable "sms_sender_id" {
  type        = string
  default     = "ForgedFound"
  description = "Alphanumeric SMS sender id (max 11 chars; UK/EU — ignored by US/CA carriers)."
}

variable "idp_secret_names" {
  type = map(string)
  default = {
    google   = "forgedandfound/infra/auth/idp/google"
    apple    = "forgedandfound/infra/auth/idp/apple"
    facebook = "forgedandfound/infra/auth/idp/facebook"
  }
  description = "Secrets Manager names holding the social IdP credentials (created out-of-band, never TF-managed)."
}

variable "shopify_secret_name" {
  type        = string
  default     = "forgedandfound/infra/shopify"
  description = "Secrets Manager name holding the Shopify Admin API credentials."
}

locals {
  is_prod = var.aws_account == "prod"

  namespace = "ff/infra/${var.aws_account}"
  prefix    = replace(local.namespace, "/", "-")

  # nonprod.forgedandfound.co.uk / prod.forgedandfound.co.uk
  account_zone_name = "${var.aws_account}.${var.root_domain}"

  environments = local.is_prod ? ["staging", "live"] : ["dev", "prv"]
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.aws_account_ids[var.aws_account]]

  default_tags {
    tags = {
      project   = "forgedandfound"
      layer     = "infra"
      namespace = local.namespace
    }
  }
}

provider "aws" {
  alias               = "us_east_1"
  region              = "us-east-1"
  allowed_account_ids = [var.aws_account_ids[var.aws_account]]
}

data "aws_caller_identity" "current" {}
