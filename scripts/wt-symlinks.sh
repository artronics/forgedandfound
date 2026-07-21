#!/usr/bin/env bash
set -uo pipefail

ROOT="$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')"

DIRS=(
  "."
  "apps/web"
  "apps/shopify"
  "terraform"
  "scripts"
  "services"
  "packages"
)

PATTERNS=(
  ".env*"
  ".claude"
)

# Link .env* and .claude into the current worktree.
for dir in "${DIRS[@]}"; do
  for pattern in "${PATTERNS[@]}"; do
    found=false

    while IFS= read -r src; do
      found=true
      rel="${src#$ROOT/}"
      ln -snf "$src" "$rel"
      echo "✅ Linked $rel"
    done < <(find "$ROOT/$dir" -maxdepth 1 \( -name "$pattern" \) 2>/dev/null)

    if [ "$found" = false ]; then
      echo "❌ Missing $dir/$pattern"
    fi
  done
done

# Create root aliases for plain .env files (excluding apps/** and root).
for dir in terraform scripts services packages; do
  src="$dir/.env"
  dst=".env.$dir"

  if [ -f "$src" ]; then
    ln -snf "$src" "$dst"
    echo "✅ Linked $dst -> $src"
  else
    echo "❌ Missing $src"
  fi
done