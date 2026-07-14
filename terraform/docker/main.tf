variable "aws_profile" {}
variable "prefix" {}

variable "region" {
  default = "eu-west-2"
}

locals {
  services_dir = "${path.root}/../services"
  packages_dir = "${path.root}/../packages"
  context_dir  = "${path.root}/.."
}

variable "service_name" {
  type        = string
  description = "The name of the service must match the directory name"
}
variable "package_dependencies" {
  type = list(string)
}

output "image_uri" {
  depends_on = [terraform_data.image]
  value = "${aws_ecr_repository.this.repository_url}:${local.service_hash}"
}

locals {
  ignore_dirs = ["node_modules", "dist", ".turbo"]

  service_watch_dir = concat(
    ["${local.services_dir}/${var.service_name}"],
    [
      for pkg in var.package_dependencies :
      "${local.packages_dir}/${pkg}"
    ]
  )

  service_hash = sha256(join("", flatten([
    for dir in local.service_watch_dir : [
      for file in sort(fileset(dir, "**")) :
      filesha256("${dir}/${file}")
      if length([
        for part in split("/", file) :
        part if contains(local.ignore_dirs, part)
      ]) == 0
    ]
  ])))
}