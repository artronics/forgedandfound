locals {
  function_name    = "${var.prefix}-${var.name}"
  source_dir       = "${path.root}/../services/${var.name}"
  context_dir  = var.context_dir != "" ? var.context_dir : "${path.root}/.."
  packages_dir = "${path.root}/../packages"
}
// Detecting file changes in the service directory and lib
// ⚠️ ⚠️ ⚠️ IMPORTANT: Do not forget to add new packages to this list otherwise build won't be triggered ⚠️ ⚠️ ⚠️
locals {
  watched_dirs = [
    local.source_dir,
    "${local.packages_dir}/lib",
    "${local.packages_dir}/email",
  ]

  source_hash = sha256(join("", flatten([
    for dir in local.watched_dirs : [
      for f in sort(fileset(dir, "**")) :
      filesha256("${dir}/${f}")
      if !contains(split("/", f), "node_modules")
      && !contains(split("/", f), "dist")
    ]
  ])))
}
# ---------------------------------------------------------------------------
# ECR
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  name                 = local.function_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# ---------------------------------------------------------------------------
# Docker build + push (triggered on source changes)
# ---------------------------------------------------------------------------

resource "terraform_data" "image" {
  triggers_replace = local.source_hash

  provisioner "local-exec" {
    environment = {
      AWS_PROFILE      = var.aws_profile
      AWS_REGION       = var.region
      ECR_REPO         = aws_ecr_repository.this.repository_url
      IMAGE_TAG        = local.source_hash
      CONTEXT_DIR      = local.context_dir
      DOCKERFILE       = "${local.source_dir}/Dockerfile"
    }

    command = <<-EOT
      set -e
      [ -z "$AWS_PROFILE" ] && unset AWS_PROFILE
      REGISTRY=$(echo "$ECR_REPO" | cut -d'/' -f1)

      # Use an isolated, ephemeral Docker config and write the ECR auth token
      # straight into config.json instead of running `docker login`. An empty
      # config dir would otherwise fall back to Docker Desktop's default
      # credential store (osxkeychain), which intermittently fails with
      # "The specified item already exists in the keychain (-25299)".
      DOCKER_CONFIG="$(mktemp -d)"
      export DOCKER_CONFIG
      trap 'rm -rf "$DOCKER_CONFIG"' EXIT

      # Keep CLI plugins (buildx) discoverable under the isolated config,
      # since Docker looks for them in $DOCKER_CONFIG/cli-plugins.
      if [ -d "$HOME/.docker/cli-plugins" ]; then
        ln -s "$HOME/.docker/cli-plugins" "$DOCKER_CONFIG/cli-plugins"
      fi

      # Base64-encode "AWS:<token>" and place it under auths.<registry>.
      # No credential helper is invoked, so the keychain is never touched.
      AUTH=$(aws ecr get-login-password --region "$AWS_REGION" \
        | { printf 'AWS:'; cat; } | base64 | tr -d '\n')
      cat > "$DOCKER_CONFIG/config.json" <<JSON
      {"auths":{"$REGISTRY":{"auth":"$AUTH"}}}
      JSON
      docker buildx build \
        --platform linux/amd64 \
        --provenance=false \
        -f "$DOCKERFILE" \
        -t "$ECR_REPO:$IMAGE_TAG" \
        -t "$ECR_REPO:latest" \
        --push \
        "$CONTEXT_DIR"
    EOT
  }

  depends_on = [aws_ecr_repository.this]
}

# ---------------------------------------------------------------------------
# CloudWatch log group
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
}

# ---------------------------------------------------------------------------
# Lambda function
# ---------------------------------------------------------------------------

resource "aws_lambda_function" "this" {
  function_name = local.function_name
  role          = var.role_arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.this.repository_url}:${local.source_hash}"

  timeout     = 30
  memory_size = 256

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.this.name
  }

  dynamic "environment" {
    for_each = length(var.environment_variables) > 0 ? [1] : []
    content {
      variables = var.environment_variables
    }
  }

  depends_on = [terraform_data.image]
}

# ---------------------------------------------------------------------------
# Invocation permissions
# ---------------------------------------------------------------------------

resource "aws_lambda_permission" "this" {
  for_each = { for p in var.permissions : p.statement_id => p }

  statement_id  = each.value.statement_id
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = each.value.principal
  source_arn    = each.value.source_arn
}
