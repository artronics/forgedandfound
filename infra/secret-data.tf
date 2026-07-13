// Google
data "aws_secretsmanager_secret" "idp_google" {
  name = "forgedandfound/infra/auth/idp/google"
}
data "aws_secretsmanager_secret_version" "idp_google_secret" {
  secret_id = data.aws_secretsmanager_secret.idp_google.id
}

// Apple
data "aws_secretsmanager_secret" "idp_apple" {
  name = "forgedandfound/infra/auth/idp/apple"
}
data "aws_secretsmanager_secret_version" "idp_apple_secret" {
  secret_id = data.aws_secretsmanager_secret.idp_apple.id
}

// Facebook
data "aws_secretsmanager_secret_version" "idp_facebook_secret" {
  secret_id = data.aws_secretsmanager_secret.idp_facebook.id
}
data "aws_secretsmanager_secret" "idp_facebook" {
  name = "forgedandfound/infra/auth/idp/facebook"
}
