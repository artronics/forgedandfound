# A Shopify partner event source can only be associated with a single event
# bus, so the bus is account-level; per-deployment rules and queues live in
# platform. Not created until shopify_app_id is set.
resource "aws_cloudwatch_event_bus" "shopify" {
  count = var.shopify_app_id == "" ? 0 : 1

  name              = "${var.shopify_app_id}/${local.prefix}-shopify-events"
  event_source_name = "aws.partner/shopify.com/${var.shopify_app_id}/${local.prefix}-shopify-events"
}
