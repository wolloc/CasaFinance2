#!/usr/bin/env bash
set -euo pipefail

# Marco 3.03: exercise Auth -> JWT -> relogin -> PostgREST session continuity.
# All identities and data live only in the isolated Supabase started by CI.
API_URL="${API_URL:-http://127.0.0.1:54321}"
SUPABASE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
: "${SUPABASE_KEY:?PUBLISHABLE_KEY or ANON_KEY is required}"
PASSWORD='Marco3-http-only-42!'
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s)"

json_field() { jq -er "$1"; }

public_auth_headers=(-H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}" -H 'Content-Type: application/json')

sign_up() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    -X POST "${API_URL}/auth/v1/signup" \
    "${public_auth_headers[@]}" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}"
}

sign_in() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    -X POST "${API_URL}/auth/v1/token?grant_type=password" \
    "${public_auth_headers[@]}" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}"
}

rpc_bootstrap() {
  local token="$1" name="$2"
  curl --fail-with-body --silent --show-error \
    -X POST "${API_URL}/rest/v1/rpc/bootstrap_household" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "{\"household_name\":\"${name}\",\"household_currency\":\"BRL\",\"household_timezone\":\"America/Sao_Paulo\"}"
}

list_households() {
  local token="$1"
  curl --fail-with-body --silent --show-error \
    "${API_URL}/rest/v1/households?select=id,name&order=name" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}"
}

wallace_email="wallace-http-${RUN_ID}@example.invalid"
third_email="third-http-${RUN_ID}@example.invalid"
wallace_json="$(sign_up "$wallace_email")"
third_json="$(sign_up "$third_email")"
wallace_token="$(printf '%s' "$wallace_json" | json_field '.access_token')"
third_token="$(printf '%s' "$third_json" | json_field '.access_token')"
wallace_user_id="$(printf '%s' "$wallace_json" | json_field '.user.id')"

# These are real GoTrue-issued JWTs, not request.jwt.claim.sub injected in SQL.
[[ "$(awk -F. '{print NF}' <<<"$wallace_token")" -eq 3 ]]
[[ "$(awk -F. '{print NF}' <<<"$third_token")" -eq 3 ]]

rpc_bootstrap "$wallace_token" 'Casa HTTP Wallace' >/dev/null
rpc_bootstrap "$third_token" 'Casa HTTP Terceira' >/dev/null

wallace_houses="$(list_households "$wallace_token")"
third_houses="$(list_households "$third_token")"

[[ "$(printf '%s' "$wallace_houses" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$third_houses" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$wallace_houses" | jq -r '.[0].name')" == 'Casa HTTP Wallace' ]]
[[ "$(printf '%s' "$third_houses" | jq -r '.[0].name')" == 'Casa HTTP Terceira' ]]
wallace_house_id="$(printf '%s' "$wallace_houses" | jq -r '.[0].id')"

# A fresh password login must recover the same Auth identity and therefore the same Casa.
# This simulates closing/reopening the app without relying on the original signup JWT.
wallace_relogin_json="$(sign_in "$wallace_email")"
wallace_relogin_token="$(printf '%s' "$wallace_relogin_json" | json_field '.access_token')"
wallace_relogin_user_id="$(printf '%s' "$wallace_relogin_json" | json_field '.user.id')"
[[ "$wallace_relogin_user_id" == "$wallace_user_id" ]]
[[ "$(awk -F. '{print NF}' <<<"$wallace_relogin_token")" -eq 3 ]]
wallace_relogin_houses="$(list_households "$wallace_relogin_token")"
[[ "$(printf '%s' "$wallace_relogin_houses" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$wallace_relogin_houses" | jq -r '.[0].id')" == "$wallace_house_id" ]]
[[ "$(printf '%s' "$wallace_relogin_houses" | jq -r '.[0].name')" == 'Casa HTTP Wallace' ]]

# Prove cross-household isolation through PostgREST, including after relogin.
third_id="$(printf '%s' "$third_houses" | jq -r '.[0].id')"
wallace_cross="$(curl --fail-with-body --silent --show-error \
  "${API_URL}/rest/v1/households?select=id&id=eq.${third_id}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${wallace_relogin_token}")"
[[ "$(printf '%s' "$wallace_cross" | jq 'length')" -eq 0 ]]

# Anonymous access must not expose household rows. A 401/403 is stronger isolation
# than an empty 200 response and is the expected contract while anon has no SELECT grant.
anon_body="$(mktemp)"
anon_status="$(curl --silent --show-error -o "$anon_body" -w '%{http_code}' \
  "${API_URL}/rest/v1/households?select=id" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")"
case "$anon_status" in
  200)
    [[ "$(jq 'length' "$anon_body")" -eq 0 ]]
    ;;
  401|403)
    ;;
  *)
    echo "Unexpected anonymous household response: HTTP ${anon_status}" >&2
    cat "$anon_body" >&2
    exit 1
    ;;
esac
rm -f "$anon_body"

echo 'Marco 3.03 Auth/JWT/relogin/PostgREST gate passed.'
