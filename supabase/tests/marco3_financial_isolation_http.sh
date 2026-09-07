#!/usr/bin/env bash
set -euo pipefail

# Marco 3.06: after the shared-household financial scenario has run, prove that
# an authenticated outsider in a different household cannot see those facts.
API_URL="${API_URL:-http://127.0.0.1:54321}"
SUPABASE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
: "${SUPABASE_KEY:?PUBLISHABLE_KEY or ANON_KEY is required}"
PASSWORD='Marco3-financial-isolation-42!'
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s)-$RANDOM"

public_headers=(-H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}" -H 'Content-Type: application/json')

auth_signup() {
  local email="$1"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/auth/v1/signup" \
    "${public_headers[@]}" \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}"
}

rpc() {
  local token="$1" name="$2" body="$3"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/rest/v1/rpc/${name}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' -d "$body"
}

rest_get() {
  local token="$1" path="$2"
  curl --fail-with-body --silent --show-error "${API_URL}/rest/v1/${path}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}"
}

outsider_json="$(auth_signup "outsider-fin-${RUN_ID}@example.invalid")"
outsider_token="$(printf '%s' "$outsider_json" | jq -er '.access_token')"

# Even before joining any household, no financial fact from Casa A is visible.
for path in \
  'transactions?select=id' \
  'economic_allocations?select=id' \
  'funding_events?select=id' \
  'money_movements?select=id'; do
  result="$(rest_get "$outsider_token" "$path")"
  printf '%s' "$result" | jq -e 'length == 0' >/dev/null
done

# Put the outsider in a different household and repeat. RLS must still hide Casa A.
rpc "$outsider_token" bootstrap_household '{"household_name":"Casa Externa HTTP","household_currency":"BRL","household_timezone":"America/Sao_Paulo"}' >/dev/null
outsider_houses="$(rest_get "$outsider_token" 'households?select=id,name')"
printf '%s' "$outsider_houses" | jq -e 'length == 1 and .[0].name == "Casa Externa HTTP"' >/dev/null

for path in \
  'transactions?select=id' \
  'economic_allocations?select=id' \
  'funding_events?select=id' \
  'money_movements?select=id'; do
  result="$(rest_get "$outsider_token" "$path")"
  printf '%s' "$result" | jq -e 'length == 0' >/dev/null
done

echo 'Marco 3.06 financial isolation gate passed.'
