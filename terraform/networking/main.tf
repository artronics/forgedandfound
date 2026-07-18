variable "root_domain" {}
variable "aws_account" {}

variable "vercel_cname" {
  type = list(string)
}
variable "shopify_cname" {
  type = list(string)
}

locals {
  is_prod = var.aws_account == "prod"
}

# root zone here is either nonprod.example.com or example.com
# It's NOT prod.example.com
data "aws_route53_zone" "root_zone" {
  name = local.is_prod ? var.root_domain : "${var.aws_account}.${var.root_domain}"
}
locals {
  root_zone_name = data.aws_route53_zone.root_zone.name
  root_zone_id   = data.aws_route53_zone.root_zone.id
}
