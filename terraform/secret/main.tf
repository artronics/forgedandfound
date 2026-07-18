variable "name" {
  type = string
}
data "aws_secretsmanager_secret" "secret" {
  name = var.name
}
data "aws_secretsmanager_secret_version" "id" {
  secret_id = data.aws_secretsmanager_secret.secret.id
}

output "secret_map" {
  value = jsondecode(data.aws_secretsmanager_secret_version.id.secret_string)
}