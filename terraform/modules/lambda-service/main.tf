variable "service_name" {
  type        = string
  description = "Must match the directory name under services/."
}
variable "function_name" {
  type = string
}
variable "repo_url" {
  type        = string
  description = "ECR repository URL (repos are account-level, provisioned in infra)."
}
variable "role_arn" {
  type = string
}
variable "region" {
  type    = string
  default = "eu-west-2"
}
variable "environment_variables" {
  type    = map(string)
  default = {}
}
variable "permissions" {
  type = list(object({
    statement_id = string
    principal    = string
    source_arn   = string
  }))
  default = []
}
variable "log_retention_days" {
  type    = number
  default = 14
}
variable "application_log_level" {
  type    = string
  default = "DEBUG"
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}
output "function_name" {
  value = aws_lambda_function.this.function_name
}
output "invoke_arn" {
  value = aws_lambda_function.this.invoke_arn
}
output "image_uri" {
  value = local.image_uri
}
