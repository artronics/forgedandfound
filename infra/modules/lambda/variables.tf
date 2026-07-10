variable "name" {
  type        = string
  description = "Lambda name — also the subdirectory under services/"
}

variable "prefix" {
  type        = string
  description = "Resource naming prefix (e.g. forgedandfound-infra-nonprod)"
}

variable "region" {
  type = string
}

variable "aws_profile" {
  type    = string
  default = ""
}

variable "role_arn" {
  type        = string
  description = "IAM execution role ARN to assign to the Lambda"
}

variable "environment_variables" {
  type        = map(string)
  default     = {}
  description = "Environment variables injected into the Lambda"
}

variable "context_dir" {
  type        = string
  default     = ""
  description = "Docker build context directory. Defaults to the project root when empty."
}

variable "permissions" {
  type = list(object({
    statement_id = string
    principal    = string
    source_arn   = string
  }))
  default     = []
  description = "Resource-based policy statements allowing principals to invoke this Lambda"
}
