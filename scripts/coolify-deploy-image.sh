#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "usage: $0 <application-uuid> <image-name> <image-tag> [health-url]" >&2
  exit 2
fi

: "${COOLIFY_URL:?COOLIFY_URL is required}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN is required}"

application_uuid="$1"
image_name="$2"
image_tag="$3"
health_url="${4:-}"
api_base="${COOLIFY_URL%/}/api/v1"

coolify_request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local args=(
    --fail-with-body
    --silent
    --show-error
    --connect-timeout 10
    --max-time 30
    -X "$method"
    -H "Authorization: Bearer ${COOLIFY_TOKEN}"
    -H 'Content-Type: application/json'
  )

  if [[ -n "$payload" ]]; then
    args+=(--data "$payload")
  fi

  curl "${args[@]}" "${api_base}${path}"
}

current="$(coolify_request GET "/applications/${application_uuid}")"
previous_image="$(jq -er '.docker_registry_image_name' <<<"$current")"
previous_tag="$(jq -er '.docker_registry_image_tag' <<<"$current")"

rollback() {
  echo "Deployment failed; restoring ${application_uuid} to its previous image tag." >&2
  local payload
  payload="$(
    jq -n \
      --arg image "$previous_image" \
      --arg tag "$previous_tag" \
      '{docker_registry_image_name: $image, docker_registry_image_tag: $tag}'
  )"
  coolify_request PATCH "/applications/${application_uuid}" "$payload" >/dev/null || true
  coolify_request POST "/applications/${application_uuid}/start" >/dev/null || true
}

payload="$(
  jq -n \
    --arg image "$image_name" \
    --arg tag "$image_tag" \
    '{docker_registry_image_name: $image, docker_registry_image_tag: $tag}'
)"
coolify_request PATCH "/applications/${application_uuid}" "$payload" >/dev/null

deployment="$(coolify_request POST "/applications/${application_uuid}/start")"
deployment_uuid="$(jq -er '.deployment_uuid' <<<"$deployment")"
echo "Queued Coolify deployment ${deployment_uuid} for ${application_uuid}."

for _ in $(seq 1 90); do
  status="$(
    coolify_request GET "/deployments/${deployment_uuid}" \
      | jq -r '.status // "unknown"'
  )"

  case "$status" in
    finished|success)
      if [[ -n "$health_url" ]] && ! curl \
        --fail \
        --silent \
        --show-error \
        --retry 12 \
        --retry-delay 5 \
        --retry-all-errors \
        "$health_url" >/dev/null; then
        echo "Deployment finished but ${health_url} did not become ready." >&2
        rollback
        exit 1
      fi

      echo "Coolify deployment ${deployment_uuid} finished successfully."
      exit 0
      ;;
    failed|cancelled|error)
      rollback
      exit 1
      ;;
  esac

  sleep 5
done

echo "Timed out waiting for Coolify deployment ${deployment_uuid}." >&2
rollback
exit 1
