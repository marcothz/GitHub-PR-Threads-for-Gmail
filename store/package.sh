#!/usr/bin/env bash
# Builds the Chrome Web Store upload zip: dist/gmail-pr-threads-<version>.zip
# with manifest.json at the root. Packs the committed files at HEAD, so commit
# your changes first.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain -- manifest.json background.js content.js content.css options.html options.js icons LICENSE)" ]]; then
  echo "Extension files have uncommitted changes. Commit them first." >&2
  exit 1
fi

version=$(git show HEAD:manifest.json | python3 -c 'import json, sys; print(json.load(sys.stdin)["version"])')
out="dist/gmail-pr-threads-${version}.zip"

mkdir -p dist
rm -f "$out"
git archive --format=zip -o "$out" HEAD \
  manifest.json background.js content.js content.css options.html options.js icons LICENSE

echo "Built $out"
unzip -l "$out"
