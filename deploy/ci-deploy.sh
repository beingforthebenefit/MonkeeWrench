#!/usr/bin/env bash
# The only thing GitHub's deploy key may do on the hosted server. Installed
# outside the repo as ~/ci-deploy (so a commit can't change what the key is
# allowed to run) and forced on the key in ~/.ssh/authorized_keys:
#
#   command="/home/deploy/ci-deploy",restrict ssh-ed25519 AAAA… github-deploy
#
# CI connects with the branch it just tested as the command. Only a push to
# the branch the server runs is deployed; anything else is a no-op.
set -euo pipefail
branch=${SSH_ORIGINAL_COMMAND:-}
if ! [[ $branch =~ ^[A-Za-z0-9._/-]{1,100}$ ]]; then
  echo "ci-deploy: expected a branch name, got '$branch'" >&2
  exit 2
fi
cd "$HOME/Bandstand"
running=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "$running" ]; then
  echo "ci-deploy: the server runs '$running'; nothing to do for '$branch'"
  exit 0
fi
echo "ci-deploy: deploying $branch on $(hostname)"
exec make hosted-deploy
