# ---------------------------------------------------------------------------
# REST API defined from the OpenAPI document. Paths, the Cognito authorizer and
# the Lambda proxy integration all live in api.yaml; templatefile injects the
# runtime ARNs Terraform knows.
# ---------------------------------------------------------------------------

locals {
  api_domain = "api.${local.deployment_domain}"
}

resource "aws_api_gateway_rest_api" "this" {
  name = "${local.prefix}-api"

  body = templatefile("${path.module}/api.yaml", {
    cognito_user_pool_arn = data.terraform_remote_state.infra.outputs.cognito_user_pool_arn
    user_service_uri      = module.user_service.invoke_arn
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

# Created here (not in user-service.tf) to avoid a dependency cycle on the
# REST API's execution ARN.
resource "aws_lambda_permission" "user_service_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.user_service.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.this.execution_arn}/*/*"
}

# ---------------------------------------------------------------------------
# Custom domain: api.<deployment-domain>, edge-optimized (us-east-1 ACM via
# the shared cert module + CloudFront), mirroring the Cognito custom domain.
# ---------------------------------------------------------------------------

module "cert" {
  source = "../modules/cert"
  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain_name = local.api_domain
  zone_id     = local.dns_zone_id
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
  zone_id = local.dns_zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_api_gateway_domain_name.this.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.this.cloudfront_zone_id
    evaluate_target_health = false
  }
}
