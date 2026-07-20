#!/usr/bin/env bash
# Build & push a service image to ECR, skipping the build when the
# content-hash tag already exists remotely. Credentials are ambient
# (AWS_PROFILE locally, OIDC role in CI) — nothing is passed in.
set -euo pipefail

REGISTRY=$(echo "$ECR_REPO" | cut -d'/' -f1)
REPO_NAME=$(echo "$ECR_REPO" | cut -d'/' -f2-)

if aws ecr describe-images \
  --region "$AWS_REGION" \
  --repository-name "$REPO_NAME" \
  --image-ids imageTag="$IMAGE_TAG" >/dev/null 2>&1; then
  echo "image $REPO_NAME:$IMAGE_TAG already in ECR — skipping build"
  exit 0
fi

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
