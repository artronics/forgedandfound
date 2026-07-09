locals {
  infra_env = var.aws_account == "prod" ? "prod" : "dev"
}
data "terraform_remote_state" "infra" {
  backend = "s3"
  config = {
    bucket = "artronics-forgedandfound-${var.aws_account}-infra-terraform-state"
    key    = "infra/${var.aws_account}/${local.infra_env}.tfstate"
    region = "eu-west-2"
  }
}

