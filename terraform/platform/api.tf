# ---------------------------------------------------------------------------
# REST API defined from the OpenAPI document. Paths, the Cognito authorizer and
# the Lambda proxy integration all live in api.yaml; templatefile injects the
# runtime ARNs Terraform knows.
# ---------------------------------------------------------------------------

locals {
  # Domains must stay inside a shared infra wildcard cert (one label deep):
  # prod api.<env>.prod.<root> is covered by the env wildcard; nonprod flattens
  # to api-<deployment>.<account-zone> to stay under the account wildcard.
  api_domain = local.is_prod ? "api.${local.deployment_domain}" : "api-${var.deployment}.${local.account_zone_name}"

  api_cert_arn = local.is_prod ? data.terraform_remote_state.infra.outputs.env_wildcard_cert_arns[local.environment] : data.terraform_remote_state.infra.outputs.account_wildcard_cert_arn
}

resource "aws_api_gateway_rest_api" "this" {
  name = "${local.prefix}-api"

  body = templatefile("${path.module}/api.yaml", {
    cognito_user_pool_arn = data.terraform_remote_state.infra.outputs.cognito_user_pool_arn
    user_service_uri      = module.user_service.invoke_arn
  })

  endpoint_configuration {
    types = ["REGIONAL"]
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
# Custom domain, REGIONAL (no CloudFront — creates and destroys in seconds),
# using the shared regional wildcard certificate from infra.
# ---------------------------------------------------------------------------

resource "aws_api_gateway_domain_name" "this" {
  domain_name              = local.api_domain
  regional_certificate_arn = local.api_cert_arn

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_base_path_mapping" "this" {
  api_id      = aws_api_gateway_rest_api.this.id
  stage_name  = aws_api_gateway_stage.this.stage_name
  domain_name = aws_api_gateway_domain_name.this.domain_name

  # Replacing the domain silently deletes its mappings while the mapping's
  # attributes (the domain *name*) look unchanged — force the mapping to be
  # recreated together with the domain.
  lifecycle {
    replace_triggered_by = [aws_api_gateway_domain_name.this.id]
  }
}

resource "aws_route53_record" "api" {
  zone_id = local.dns_zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name    = aws_api_gateway_domain_name.this.regional_domain_name
    zone_id = aws_api_gateway_domain_name.this.regional_zone_id
    evaluate_target_health = false
  }
}
