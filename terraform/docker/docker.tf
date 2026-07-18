locals {
  dockerfile = "${local.services_dir}/${var.service_name}/Dockerfile"
}
resource "terraform_data" "image" {
  triggers_replace = local.service_hash

  provisioner "local-exec" {
    environment = {
      AWS_PROFILE = var.aws_profile
      AWS_REGION  = var.region
      ECR_REPO    = aws_ecr_repository.this.repository_url
      IMAGE_TAG   = local.service_hash
      CONTEXT_DIR = local.context_dir
      DOCKERFILE  = local.dockerfile
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

