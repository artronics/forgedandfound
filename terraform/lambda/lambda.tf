resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = local.is_prod ? 60 : 14
}

resource "aws_lambda_function" "this" {
  function_name = var.function_name
  role          = var.role_arn
  package_type  = "Image"
  image_uri     = var.image_uri

  timeout     = 30
  memory_size = 256

  logging_config {
    log_format            = "JSON"
    log_group             = aws_cloudwatch_log_group.this.name
    application_log_level = local.is_prod ? "INFO" : "DEBUG"
    system_log_level      = local.is_prod ? "WARN" : "WARN"
  }

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }
}

# ---------------------------------------------------------------------------
# Invocation permissions
# ---------------------------------------------------------------------------

resource "aws_lambda_permission" "this" {
  for_each = { for p in var.permissions : p.statement_id => p }

  statement_id  = each.value.statement_id
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = each.value.principal
  source_arn    = each.value.source_arn
}
