variable "root_domain" {
  type = string
}
variable "aws_account" {
  type = string
}

variable "vercel_cname" {
  type = list(string)
}
variable "shopify_cname" {
  type = list(string)
}
