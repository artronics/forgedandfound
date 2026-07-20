# ---------------------------------------------------------------------------
# Image build. Workspace dependencies are derived from the service's
# package.json (plus one transitive hop through packages/*), so adding a
# dependency to a service never requires a terraform change. The content hash
# over the service + its dependency dirs is the image tag; the build script
# skips the docker build entirely when that tag already exists in ECR, so
# ephemeral deployments reuse images.
# ---------------------------------------------------------------------------

locals {
  repo_root    = abspath("${path.module}/../../..")
  services_dir = "${local.repo_root}/services"
  packages_dir = "${local.repo_root}/packages"

  workspace_prefix = "@forgedandfound/"

  service_pkg = jsondecode(file("${local.services_dir}/${var.service_name}/package.json"))
  direct_deps = [
    for name, _ in merge(
      lookup(local.service_pkg, "dependencies", {}),
      lookup(local.service_pkg, "devDependencies", {}),
    ) : trimprefix(name, local.workspace_prefix) if startswith(name, local.workspace_prefix)
  ]

  # One transitive hop is enough for the current graph
  # (e.g. shopify-admin-client -> secret-manager); deepen if it ever nests further.
  transitive_deps = flatten([
    for dep in local.direct_deps : [
      for name, _ in merge(
        lookup(jsondecode(file("${local.packages_dir}/${dep}/package.json")), "dependencies", {}),
        lookup(jsondecode(file("${local.packages_dir}/${dep}/package.json")), "devDependencies", {}),
      ) : trimprefix(name, local.workspace_prefix) if startswith(name, local.workspace_prefix)
    ]
  ])

  package_deps = distinct(concat(local.direct_deps, local.transitive_deps))

  ignore_dirs = ["node_modules", "dist", ".turbo"]

  watch_dirs = concat(
    ["${local.services_dir}/${var.service_name}"],
    [for pkg in local.package_deps : "${local.packages_dir}/${pkg}"],
  )

  service_hash = sha256(join("", flatten([
    for dir in local.watch_dirs : [
      for file in sort(fileset(dir, "**")) :
      filesha256("${dir}/${file}")
      if length([
        for part in split("/", file) :
        part if contains(local.ignore_dirs, part)
      ]) == 0
    ]
  ])))

  image_uri = "${var.repo_url}:${local.service_hash}"
}

resource "terraform_data" "image" {
  triggers_replace = local.service_hash

  provisioner "local-exec" {
    command = "${path.module}/build-push.sh"

    environment = {
      AWS_REGION  = var.region
      ECR_REPO    = var.repo_url
      IMAGE_TAG   = local.service_hash
      CONTEXT_DIR = local.repo_root
      DOCKERFILE  = "${local.services_dir}/${var.service_name}/Dockerfile"
    }
  }
}
