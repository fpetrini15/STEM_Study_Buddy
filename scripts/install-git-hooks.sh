#!/bin/sh
# Install project git hooks from .githooks/ into .git/hooks/

set -e

root=$(git rev-parse --show-toplevel)
cd "$root"

if [ ! -d .git/hooks ]; then
  echo "Error: .git/hooks not found. Is this a git repository?" >&2
  exit 1
fi

for hook in .githooks/*; do
  name=$(basename "$hook")
  target=".git/hooks/$name"

  cp "$hook" "$target"
  chmod +x "$target"
  echo "Installed $target"
done

echo "Done. Hooks will run locally on commit (Lewis files) and on push/PR via GitHub Actions."
