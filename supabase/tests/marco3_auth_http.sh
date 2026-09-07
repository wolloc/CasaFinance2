#!/usr/bin/env bash
set -euo pipefail

# Marco 3.02: exercise the same Auth -> JWT -> PostgREST boundary used by the app.
# All identities and data live only in the isolated Supabase started by CI.
API_URL="${API_URL:-http://127.0.0.1:54321}"
SUPABASE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
: "${SUPABASE_KEY:?PUBLISHABLE_KEY or ANON_KEY is required}"
PASSWORD='Marco3-http-only-42!'
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s)"

json_field() { jq -er "$1"; }

sign_up() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    -X POST "${API_URL}/auth/v1/signup" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H 'Content-Type: application/json' \
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

wallace_json="$(sign_up "wallace-http-${RUN_ID}@example.invalid")"
third_json="$(sign_up "third-http-${RUN_ID}@example.invalid")"
wallace_token="$(printf '%s' "$wallace_json" | json_field '.access_token')"
third_token="$(printf '%s' "$third_json" | json_field '.access_token')"

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

# Prove cross-household isolation through PostgREST, not direct SQL role switching.
third_id="$(printf '%s' "$third_houses" | jq -r '.[0].id')"
wallace_cross="$(curl --fail-with-body --silent --show-error \
  "${API_URL}/rest/v1/households?select=id&id=eq.${third_id}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${wallace_token}")"
[[ "$(printf '%s' "$wallace_cross" | jq 'length')" -eq 0 ]]

# Anonymous access must not expose household rows.
anon_houses="$(curl --fail-with-body --silent --show-error \
  "${API_URL}/rest/v1/households?select=id" \
  -H "apikey: ${SUPABASE_KEY}")"
[[ "$(printf '%s' "$anon_houses" | jq 'length')" -eq 0 ]]

echo 'Marco 3.02 Auth/JWT/PostgREST gate passed.'
