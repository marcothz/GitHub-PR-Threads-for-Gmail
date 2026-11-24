#!/usr/bin/env bash
# Builds both zips from the committed files at HEAD:
#   dist/gmail-pr-threads-<version>-webstore.zip  Chrome Web Store upload (manifest.json at the root)
#   dist/gmail-pr-threads-v<version>.zip          GitHub release (files inside gmail-pr-threads/)
# Commit your changes first: uncommitted edits are not packed.
set -euo pipefail

cd "$(dirname "$0")/.."

EXTENSION_FILES=(manifest.json background.js content.js content.css options.html options.js icons LICENSE)

if [[ -n "$(git status --porcelain -- "${EXTENSION_FILES[@]}" README.md)" ]]; then
  echo "Extension files have uncommitted changes. Commit them first." >&2
  exit 1
fi

version=$(git show HEAD:manifest.json | python3 -c 'import json, sys; print(json.load(sys.stdin)["version"])')
store_zip="dist/gmail-pr-threads-${version}-webstore.zip"
release_zip="dist/gmail-pr-threads-v${version}.zip"

mkdir -p dist
rm -f "$store_zip" "$release_zip"
git archive --format=zip -o "$store_zip" HEAD "${EXTENSION_FILES[@]}"
git archive --format=zip --prefix=gmail-pr-threads/ -o "$release_zip" HEAD "${EXTENSION_FILES[@]}" README.md

echo "Built $store_zip"
echo "Built $release_zip"
