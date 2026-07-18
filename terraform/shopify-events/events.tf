locals {
  event_queue_name = "product-events"
}
resource "aws_sqs_queue" "product_events" {
  name = "${local.prefix}-${local.event_queue_name}"

  visibility_timeout_seconds = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.product_events_dlq.arn
    maxReceiveCount     = 5
  })
}

resource "aws_sqs_queue" "product_events_dlq" {
  name = "${local.prefix}-${local.event_queue_name}-dlq"
}

resource "aws_sqs_queue_policy" "product_events" {
  queue_url = aws_sqs_queue.product_events.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "events.amazonaws.com"
        }

        Action = "sqs:SendMessage"

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
  name           = "${local.prefix}-product-created"
  event_bus_name = aws_cloudwatch_event_bus.shopify.name

  event_pattern = jsonencode({
    detail-type = [
      "products/create"
    ]
  })
}

resource "aws_cloudwatch_event_target" "product_queue" {
  rule           = aws_cloudwatch_event_rule.product_created.name
  event_bus_name = aws_cloudwatch_event_bus.shopify.name
  arn            = aws_sqs_queue.product_events.arn
}