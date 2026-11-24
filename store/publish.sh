#!/usr/bin/env bash
# Uploads a zip to the Chrome Web Store and submits it for review
# (Chrome Web Store API V2).
#
# Usage: store/publish.sh dist/gmail-pr-threads-<version>-webstore.zip
#
# Needs these environment variables (set them up with store/setup-webstore-api.sh):
#   CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN  OAuth credentials
#   CWS_PUBLISHER_ID, CWS_EXTENSION_ID                   which item to update
set -euo pipefail

zip="${1:?Usage: $0 <webstore zip>}"
[[ -f "$zip" ]] || { echo "No such file: $zip" >&2; exit 1; }

for var in CWS_CLIENT_ID CWS_CLIENT_SECRET CWS_REFRESH_TOKEN CWS_PUBLISHER_ID CWS_EXTENSION_ID; do
  [[ -n "${!var:-}" ]] || { echo "Missing environment variable $var" >&2; exit 1; }
done

API="https://chromewebstore.googleapis.com"
ITEM="publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}"

# json_field FIELD reads a top-level or dotted field from JSON on stdin.
json_field() {
  python3 -c '
import json, sys
value = json.load(sys.stdin)
for key in sys.argv[1].split("."):
    value = value.get(key) if isinstance(value, dict) else None
print("" if value is None else value)
' "$1"
}

echo "Getting an access token…"
token_response=$(curl -sS https://oauth2.googleapis.com/token \
  --data-urlencode "client_id=${CWS_CLIENT_ID}" \
  --data-urlencode "client_secret=${CWS_CLIENT_SECRET}" \
  --data-urlencode "refresh_token=${CWS_REFRESH_TOKEN}" \
  --data-urlencode "grant_type=refresh_token")
access_token=$(json_field access_token <<<"$token_response")
if [[ -z "$access_token" ]]; then
  echo "Could not get an access token. Google answered:" >&2
  echo "$token_response" >&2
  echo "If the error is invalid_grant, the refresh token expired or was revoked: run store/setup-webstore-api.sh again." >&2
  exit 1
fi
auth=(-H "Authorization: Bearer ${access_token}")

echo "Uploading $zip…"
upload_response=$(curl -sS "${auth[@]}" -X POST -T "$zip" "${API}/upload/v2/${ITEM}:upload")
echo "$upload_response"
upload_state=$(json_field uploadState <<<"$upload_response")

for _ in $(seq 1 30); do
  [[ "$upload_state" == "IN_PROGRESS" || "$upload_state" == "UPLOAD_IN_PROGRESS" ]] || break
  sleep 10
  status_response=$(curl -sS "${auth[@]}" "${API}/v2/${ITEM}:fetchStatus")
  upload_state=$(json_field lastAsyncUploadState <<<"$status_response")
  echo "Upload state: $upload_state"
done

if [[ "$upload_state" != "SUCCEEDED" ]]; then
  echo "Upload did not succeed (state: ${upload_state:-unknown})." >&2
  echo "Common causes: the manifest version is not higher than the last upload, or the previous version is still in review." >&2
  exit 1
fi

echo "Submitting for review…"
publish_response=$(curl -sS "${auth[@]}" -X POST -H "Content-Type: application/json" -d '{}' "${API}/v2/${ITEM}:publish")
echo "$publish_response"
state=$(json_field state <<<"$publish_response")

case "$state" in
  PENDING_REVIEW|PUBLISHED|STAGED|PUBLISHED_TO_TESTERS)
    echo "Done. Item state: $state"
    ;;
  *)
    echo "Publish did not go through (state: ${state:-unknown})." >&2
    exit 1
    ;;
esac
