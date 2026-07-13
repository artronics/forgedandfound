# ---------------------------------------------------------------------------
# Shopify events – PER ENVIRONMENT.
#
# A Shopify partner event bus plus an SQS queue (+ DLQ) fed by an EventBridge
# rule. Each environment gets its own bus so product events don't cross envs.
# ---------------------------------------------------------------------------

variable "prefix" {
  type        = string
  description = "Per-environment naming prefix, e.g. ff-development"
}

variable "shopify_app_id" {
  type        = string
  description = "Shopify app / client id (owns the partner event source name)"
}

locals {
  name             = "${var.prefix}-shopify"
  shopify_bus_name = "aws.partner/shopify.com/${var.shopify_app_id}/${local.name}-events"
  event_queue_name = "product-events"
}

resource "aws_cloudwatch_event_bus" "shopify" {
  name              = "${var.shopify_app_id}/${local.name}-events"
  event_source_name = local.shopify_bus_name
}

resource "aws_sqs_queue" "product_events" {
  name                       = "${local.name}-${local.event_queue_name}"
  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.product_events_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "product_events_dlq" {
  name = "${local.name}-${local.event_queue_name}-dlq"
}

resource "aws_sqs_queue_policy" "product_events" {
  queue_url = aws_sqs_queue.product_events.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.product_events.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.product_created.arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "product_created" {
  name           = "${local.name}-product-created"
  event_bus_name = aws_cloudwatch_event_bus.shopify.name

  event_pattern = jsonencode({
    detail-type = ["products/create"]
  })
}

resource "aws_cloudwatch_event_target" "product_queue" {
  rule           = aws_cloudwatch_event_rule.product_created.name
  event_bus_name = aws_cloudwatch_event_bus.shopify.name
  arn            = aws_sqs_queue.product_events.arn
}

output "event_bus_arn" {
  value = aws_cloudwatch_event_bus.shopify.arn
}

output "product_queue_url" {
  value = aws_sqs_queue.product_events.url
}
