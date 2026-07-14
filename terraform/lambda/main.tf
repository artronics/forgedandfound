variable "prefix" {}
variable "region" {
  default = "eu-west-2"
}
variable "aws_profile" {}

variable "function_name" {}
variable "image_uri" {
  description = "Image uri for the ecr repo, including the tag (source hash)"
}

variable "role_arn" {}
variable "environment_variables" {
  type = map(string)
  default = {}
  description = "Environment variables injected into the Lambda"
}

variable "permissions" {
  type = list(object({
    statement_id = string
    principal    = string
    source_arn   = string
  }))
  default = []
  description = "Resource-based policy statements allowing principals to invoke this Lambda"
}

output "function_name" {
  value = aws_lambda_function.this.function_name
}
output "function_arn" {
  value = aws_lambda_function.this.arn
}
