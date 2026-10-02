#!/usr/bin/env bash
set -euo pipefail

# Marco 3.04: prove Auth/JWT, relogin and a real shared-household invitation flow.
API_URL="${API_URL:-http://127.0.0.1:54321}"
SUPABASE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
: "${SUPABASE_KEY:?PUBLISHABLE_KEY or ANON_KEY is required}"
PASSWORD='Marco3-http-only-42!'
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s)"

json_field() { jq -er "$1"; }
public_auth_headers=(-H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}" -H 'Content-Type: application/json')

sign_up() {
  local email="$1"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/auth/v1/signup" \
    "${public_auth_headers[@]}" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}"
}

sign_in() {
  local email="$1"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/auth/v1/token?grant_type=password" \
    "${public_auth_headers[@]}" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}"
}

rpc() {
  local token="$1" name="$2" body="$3"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/rest/v1/rpc/${name}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "$body"
}

list_households() {
  local token="$1"
  curl --fail-with-body --silent --show-error \
    "${API_URL}/rest/v1/households?select=id,name&order=name" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}"
}

list_members() {
  local token="$1" household_id="$2"
  curl --fail-with-body --silent --show-error \
    "${API_URL}/rest/v1/household_members?select=profile_id,role&household_id=eq.${household_id}&deactivated_at=is.null&order=joined_at" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${token}"
}

wallace_email="wallace-http-${RUN_ID}@example.invalid"
guilherme_email="guilherme-http-${RUN_ID}@example.invalid"
third_email="third-http-${RUN_ID}@example.invalid"
echo '[auth-gate] signup wallace' >&2
wallace_json="$(sign_up "$wallace_email")"
echo '[auth-gate] signup guilherme' >&2
guilherme_json="$(sign_up "$guilherme_email")"
echo '[auth-gate] signup third' >&2
third_json="$(sign_up "$third_email")"
wallace_token="$(printf '%s' "$wallace_json" | json_field '.access_token')"
guilherme_token="$(printf '%s' "$guilherme_json" | json_field '.access_token')"
third_token="$(printf '%s' "$third_json" | json_field '.access_token')"
wallace_user_id="$(printf '%s' "$wallace_json" | json_field '.user.id')"
guilherme_user_id="$(printf '%s' "$guilherme_json" | json_field '.user.id')"

[[ "$(awk -F. '{print NF}' <<<"$wallace_token")" -eq 3 ]]
[[ "$(awk -F. '{print NF}' <<<"$guilherme_token")" -eq 3 ]]
[[ "$(awk -F. '{print NF}' <<<"$third_token")" -eq 3 ]]

echo '[auth-gate] bootstrap wallace' >&2
rpc "$wallace_token" bootstrap_household '{"household_name":"Casa HTTP Wallace e Guilherme","household_currency":"BRL","household_timezone":"America/Sao_Paulo"}' >/dev/null
echo '[auth-gate] bootstrap third' >&2
rpc "$third_token" bootstrap_household '{"household_name":"Casa HTTP Terceira","household_currency":"BRL","household_timezone":"America/Sao_Paulo"}' >/dev/null

wallace_houses="$(list_households "$wallace_token")"
third_houses="$(list_households "$third_token")"
[[ "$(printf '%s' "$wallace_houses" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$third_houses" | jq 'length')" -eq 1 ]]
wallace_house_id="$(printf '%s' "$wallace_houses" | jq -r '.[0].id')"
third_house_id="$(printf '%s' "$third_houses" | jq -r '.[0].id')"

# Wallace, as owner, creates an email-bound invitation for Guilherme.
echo '[auth-gate] create invitation' >&2
invitation_json="$(rpc "$wallace_token" create_household_invitation "{\"invited_email\":\"${guilherme_email}\"}")"
invitation_token="$(printf '%s' "$invitation_json" | jq -er '.[0].token')"
invitation_house_id="$(printf '%s' "$invitation_json" | jq -er '.[0].household_id')"
[[ "$invitation_house_id" == "$wallace_house_id" ]]
[[ "${#invitation_token}" -eq 64 ]]

# Guilherme accepts with his own real JWT and joins exactly Wallace's Casa.
echo '[auth-gate] accept invitation' >&2
accept_json="$(rpc "$guilherme_token" accept_household_invitation "{\"invitation_token\":\"${invitation_token}\"}")"
[[ "$(printf '%s' "$accept_json" | jq -r '.[0].status')" == 'accepted' ]]
[[ "$(printf '%s' "$accept_json" | jq -r '.[0].household_id')" == "$wallace_house_id" ]]

guilherme_houses="$(list_households "$guilherme_token")"
[[ "$(printf '%s' "$guilherme_houses" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$guilherme_houses" | jq -r '.[0].id')" == "$wallace_house_id" ]]
[[ "$(printf '%s' "$guilherme_houses" | jq -r '.[0].name')" == 'Casa HTTP Wallace e Guilherme' ]]

# Both authenticated members see the same two active memberships and the expected roles.
wallace_members="$(list_members "$wallace_token" "$wallace_house_id")"
guilherme_members="$(list_members "$guilherme_token" "$wallace_house_id")"
[[ "$(printf '%s' "$wallace_members" | jq 'length')" -eq 2 ]]
[[ "$(printf '%s' "$guilherme_members" | jq 'length')" -eq 2 ]]
[[ "$(printf '%s' "$wallace_members" | jq -r --arg id "$wallace_user_id" '.[] | select(.profile_id==$id) | .role')" == 'owner' ]]
[[ "$(printf '%s' "$wallace_members" | jq -r --arg id "$guilherme_user_id" '.[] | select(.profile_id==$id) | .role')" == 'member' ]]

# A fresh Wallace login must still resolve the same shared Casa.
echo '[auth-gate] relogin wallace' >&2
wallace_relogin_json="$(sign_in "$wallace_email")"
wallace_relogin_token="$(printf '%s' "$wallace_relogin_json" | json_field '.access_token')"
[[ "$(printf '%s' "$wallace_relogin_json" | json_field '.user.id')" == "$wallace_user_id" ]]
wallace_relogin_houses="$(list_households "$wallace_relogin_token")"
[[ "$(printf '%s' "$wallace_relogin_houses" | jq -r '.[0].id')" == "$wallace_house_id" ]]

# The unrelated third identity cannot see Wallace/Guilherme's Casa, and vice versa.
third_cross="$(curl --fail-with-body --silent --show-error \
  "${API_URL}/rest/v1/households?select=id&id=eq.${wallace_house_id}" \
  -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${third_token}")"
wallace_cross="$(curl --fail-with-body --silent --show-error \
  "${API_URL}/rest/v1/households?select=id&id=eq.${third_house_id}" \
  -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${wallace_relogin_token}")"
[[ "$(printf '%s' "$third_cross" | jq 'length')" -eq 0 ]]
[[ "$(printf '%s' "$wallace_cross" | jq 'length')" -eq 0 ]]

# Anonymous access must remain fail-closed.
anon_body="$(mktemp)"
anon_status="$(curl --silent --show-error -o "$anon_body" -w '%{http_code}' \
  "${API_URL}/rest/v1/households?select=id" \
  -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}")"
case "$anon_status" in
  200) [[ "$(jq 'length' "$anon_body")" -eq 0 ]] ;;
  401|403) ;;
  *) echo "Unexpected anonymous household response: HTTP ${anon_status}" >&2; cat "$anon_body" >&2; exit 1 ;;
esac
rm -f "$anon_body"

echo 'Marco 3.04 shared-household invitation gate passed.'
