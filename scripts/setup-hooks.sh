#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

echo "Setting core.hooksPath to .githooks"
git config core.hooksPath .githooks

echo "Making hooks executable"
chmod -R +x .githooks || true

echo "Done. Git hooks installed."
