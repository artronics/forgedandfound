variable "aws_account" {}
variable "region" {}
variable "root_zone_name" {}
variable "prefix" {}

output "ses_email_identity_arn" {
  value = aws_sesv2_email_identity.account.arn
}
output "ses_email_identity" {
  value = aws_sesv2_email_identity.account.email_identity
}
output "ses_email_domain" {
  value = local.ses_domain
}