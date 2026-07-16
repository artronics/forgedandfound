# ---------------------------------------------------------------------------
# REST API defined from the OpenAPI document. Paths, the Cognito authorizer and
# the Lambda proxy integration all live in api.yaml; templatefile injects the
# runtime ARNs Terraform knows.
# ---------------------------------------------------------------------------
resource "aws_api_gateway_rest_api" "this" {
  name = "${var.prefix}-api"

  body = templatefile("${path.module}/api.yaml", {
    cognito_user_pool_arn = var.cognito_user_pool_arn
    user_service_uri      = var.user_service_invoke_arn
  })

  endpoint_configuration {
    types = ["EDGE"]
  }
}

resource "aws_api_gateway_deployment" "this" {
  rest_api_id = aws_api_gateway_rest_api.this.id

  # Redeploy whenever the OpenAPI body changes.
  triggers = {
    redeploy = sha1(jsonencode(aws_api_gateway_rest_api.this.body))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "this" {
  rest_api_id   = aws_api_gateway_rest_api.this.id
  deployment_id = aws_api_gateway_deployment.this.id
  stage_name    = "v1"
}

# Allow API Gateway to invoke the user-service Lambda. Created here (not in
# user-service.tf) to avoid a dependency cycle on the REST API's execution ARN.
resource "aws_lambda_permission" "user_service_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.user_service_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*"
}

# ---------------------------------------------------------------------------
# Custom domain: api.<account>.<root_domain>, edge-optimized (us-east-1 ACM via
# the shared cert module + CloudFront), mirroring the Cognito custom domain.
# ---------------------------------------------------------------------------
data "aws_route53_zone" "zone" {
  name = local.is_prod ? var.root_domain : "${var.aws_account}.${var.root_domain}"
}

module "cert" {
  source      = "../cert"
  domain_name = local.api_domain
  zone_id     = data.aws_route53_zone.zone.zone_id
}

resource "aws_api_gateway_domain_name" "this" {
  domain_name     = local.api_domain
  certificate_arn = module.cert.cert_arn

  endpoint_configuration {
    types = ["EDGE"]
  }
}

resource "aws_api_gateway_base_path_mapping" "this" {
  api_id      = aws_api_gateway_rest_api.this.id
  stage_name  = aws_api_gateway_stage.this.stage_name
  domain_name = aws_api_gateway_domain_name.this.domain_name
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.zone.zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_api_gateway_domain_name.this.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.this.cloudfront_zone_id
    evaluate_target_health = false
  }
}

output "api_url" {
  value = "https://${local.api_domain}"
}
