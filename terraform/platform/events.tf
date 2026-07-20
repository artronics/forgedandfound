# Per-deployment consumers on the shared (account-level) Shopify partner event
# bus. Skipped entirely while infra has no bus (shopify_app_id unset).

locals {
  # try(): terraform drops null-valued outputs from state, so the attribute is
  # absent (not null) while infra has no bus.
  shopify_event_bus_name = try(data.terraform_remote_state.infra.outputs.shopify_event_bus_name, null)
  events_enabled         = local.shopify_event_bus_name != null
}

resource "aws_sqs_queue" "product_events" {
  count = local.events_enabled ? 1 : 0

  name = "${local.prefix}-product-events"

  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.product_events_dlq[0].arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "product_events_dlq" {
  count = local.events_enabled ? 1 : 0

  name = "${local.prefix}-product-events-dlq"
}

resource "aws_sqs_queue_policy" "product_events" {
  count = local.events_enabled ? 1 : 0

  queue_url = aws_sqs_queue.product_events[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.product_events[0].arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.product_created[0].arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "product_created" {
  count = local.events_enabled ? 1 : 0

  name           = "${local.prefix}-product-created"
  event_bus_name = local.shopify_event_bus_name

  event_pattern = jsonencode({
    detail-type = [
      "products/create"
    ]
  })
}

resource "aws_cloudwatch_event_target" "product_queue" {
  count = local.events_enabled ? 1 : 0

  rule           = aws_cloudwatch_event_rule.product_created[0].name
  event_bus_name = local.shopify_event_bus_name
  arn            = aws_sqs_queue.product_events[0].arn
}
