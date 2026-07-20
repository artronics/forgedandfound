# ECR repos are account-level so every platform deployment shares the image
# cache — images are tagged by content hash, so an ephemeral deployment whose
# code matches an existing image never builds.
locals {
  services = [
    "auth-email-hook-handler",
    "auth-shopify-customer-sync-handler",
    "user-service",
  ]
}

resource "aws_ecr_repository" "service" {
  for_each = toset(local.services)

  name                 = "ff/${var.aws_account}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "service" {
  for_each = toset(local.services)

  repository = aws_ecr_repository.service[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = { type = "expire" }
      }
    ]
  })
}
