locals {
  prefix           = "${var.prefix}-shopify"
  shopify_bus_name = "aws.partner/shopify.com/${var.shopify_app_id}/${local.prefix}-events"
  # shopify_bus_name = "${local.prefix}-events"
}
data "aws_caller_identity" "current" {}

resource "aws_cloudwatch_event_bus" "shopify" {
  name              = "${var.shopify_app_id}/${local.prefix}-events"
  event_source_name = local.shopify_bus_name
}
