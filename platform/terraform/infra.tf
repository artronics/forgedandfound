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

locals {
  cognito_user_pool_id = data.terraform_remote_state.infra.outputs.cognito_user_pool_id
}
