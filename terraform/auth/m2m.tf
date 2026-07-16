# ---------------------------------------------------------------------------
# Machine-to-machine auth for the internal API. The Next.js BFF authenticates
# to API Gateway with a client-credentials token carrying the `account/write`
# scope; only holders of this app client's secret can call the account API.
# ---------------------------------------------------------------------------
resource "aws_cognito_resource_server" "account" {
  identifier   = "account"
  name         = "${var.prefix}-account"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "write"
    scope_description = "Write access to account operations"
  }
}

resource "aws_cognito_user_pool_client" "m2m" {
  name         = "${var.prefix}-account-m2m"
  user_pool_id = aws_cognito_user_pool.main.id

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["client_credentials"]
  allowed_oauth_scopes                 = aws_cognito_resource_server.account.scope_identifiers
  supported_identity_providers         = ["COGNITO"]

  generate_secret = true

  token_validity_units {
    access_token = "hours"
  }
  access_token_validity = 1
}
