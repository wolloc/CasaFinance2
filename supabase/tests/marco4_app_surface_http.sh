#!/usr/bin/env bash
set -euo pipefail

# Marco 4 / Trilha 1: exercise the same PostgREST surface used by a fresh Casa.
# This gate exists because SQL/RLS tests alone did not catch missing table ACLs
# that real authenticated browser requests hit before RLS is evaluated.
API_URL="${API_URL:-http://127.0.0.1:54321}"
SUPABASE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
: "${SUPABASE_KEY:?PUBLISHABLE_KEY or ANON_KEY is required}"
PASSWORD='Marco4-app-surface-42!'
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s)"

headers() {
  local token="$1"
  printf '%s\n' "apikey: ${SUPABASE_KEY}" "Authorization: Bearer ${token}" 'Content-Type: application/json'
}

sign_up() {
  local email="$1"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/auth/v1/signup" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}" -H 'Content-Type: application/json' \
    -d "{\"email\":\"${email}\",\"password\":\"${PASSWORD}\"}"
}

rpc() {
  local token="$1" name="$2" body="$3"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/rest/v1/rpc/${name}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d "$body"
}

get_rel() {
  local token="$1" relation="$2" query="$3"
  curl --fail-with-body --silent --show-error \
    "${API_URL}/rest/v1/${relation}?${query}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}"
}

post_rel() {
  local token="$1" relation="$2" body="$3"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/rest/v1/${relation}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' -H 'Prefer: return=representation' \
    -d "$body"
}

patch_rel() {
  local token="$1" relation="$2" query="$3" body="$4"
  curl --fail-with-body --silent --show-error -X PATCH "${API_URL}/rest/v1/${relation}?${query}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' -H 'Prefer: return=representation' \
    -d "$body"
}

wallace_email="wallace-app-surface-${RUN_ID}@example.invalid"
third_email="third-app-surface-${RUN_ID}@example.invalid"
wallace_json="$(sign_up "$wallace_email")"
third_json="$(sign_up "$third_email")"
wallace_token="$(printf '%s' "$wallace_json" | jq -er '.access_token')"
third_token="$(printf '%s' "$third_json" | jq -er '.access_token')"
wallace_user_id="$(printf '%s' "$wallace_json" | jq -er '.user.id')"

rpc "$wallace_token" bootstrap_household '{"household_name":"Casa App Surface","household_currency":"BRL","household_timezone":"America/Sao_Paulo"}' >/dev/null
rpc "$third_token" bootstrap_household '{"household_name":"Casa Isolada App Surface","household_currency":"BRL","household_timezone":"America/Sao_Paulo"}' >/dev/null

house_json="$(get_rel "$wallace_token" households 'select=id,name&name=eq.Casa%20App%20Surface')"
[[ "$(printf '%s' "$house_json" | jq 'length')" -eq 1 ]]
house_id="$(printf '%s' "$house_json" | jq -er '.[0].id')"
member_json="$(get_rel "$wallace_token" household_members "select=id,profile_id&profile_id=eq.${wallace_user_id}&deactivated_at=is.null")"
[[ "$(printf '%s' "$member_json" | jq 'length')" -eq 1 ]]
member_id="$(printf '%s' "$member_json" | jq -er '.[0].id')"

# Fresh-household reads used by Home. Empty data is valid; permission errors are not.
for relation in \
  financial_household_position \
  financial_member_positions \
  financial_projection_confidence_positions \
  financial_card_health_positions \
  financial_member_settlement_positions \
  financial_account_balances; do
  get_rel "$wallace_token" "$relation" "select=*&household_id=eq.${house_id}" >/dev/null
done

rpc "$wallace_token" financial_household_health_position "{\"p_household_id\":\"${house_id}\"}" >/dev/null
rpc "$wallace_token" financial_priority_attention_items "{\"p_household_id\":\"${house_id}\"}" >/dev/null
rpc "$wallace_token" financial_monthly_projection "{\"p_household_id\":\"${house_id}\",\"p_reference_month\":\"$(date +%Y-%m-01)\",\"p_horizon_months\":3}" >/dev/null
rpc "$wallace_token" financial_liquidity_guidance "{\"p_household_id\":\"${house_id}\"}" >/dev/null

# Direct setup reads used by Ajustes must work on an empty household.
for relation in accounts cards categories transactions recurring_rules recurring_occurrences card_invoices funding_events installment_plans money_movements; do
  get_rel "$wallace_token" "$relation" "select=*&household_id=eq.${house_id}&limit=1" >/dev/null
done

# The current setup UI deliberately writes accounts/cards/categories directly.
account_json="$(post_rel "$wallace_token" accounts "{\"household_id\":\"${house_id}\",\"owner_member_id\":\"${member_id}\",\"name\":\"Conta Teste\",\"type\":\"checking\",\"opening_balance\":1250}")"
[[ "$(printf '%s' "$account_json" | jq 'length')" -eq 1 ]]
account_id="$(printf '%s' "$account_json" | jq -er '.[0].id')"

card_json="$(post_rel "$wallace_token" cards "{\"household_id\":\"${house_id}\",\"owner_member_id\":\"${member_id}\",\"name\":\"Cartao Teste\",\"credit_limit\":5000,\"closing_day\":10,\"due_day\":17,\"default_payment_account_id\":\"${account_id}\"}")"
[[ "$(printf '%s' "$card_json" | jq 'length')" -eq 1 ]]

category_json="$(post_rel "$wallace_token" categories "{\"household_id\":\"${house_id}\",\"name\":\"Mercado\",\"type\":\"expense\"}")"
[[ "$(printf '%s' "$category_json" | jq 'length')" -eq 1 ]]
category_id="$(printf '%s' "$category_json" | jq -er '.[0].id')"
updated_category="$(patch_rel "$wallace_token" categories "id=eq.${category_id}&household_id=eq.${house_id}" '{"name":"Mercado e feira"}')"
[[ "$(printf '%s' "$updated_category" | jq -r '.[0].name')" == 'Mercado e feira' ]]

# Security-invoker Home read models must still work once setup data exists.
home_after_setup="$(get_rel "$wallace_token" financial_household_position "select=household_id,available_money&household_id=eq.${house_id}")"
[[ "$(printf '%s' "$home_after_setup" | jq 'length')" -eq 1 ]]
get_rel "$wallace_token" financial_account_balances "select=account_id,name,current_balance&household_id=eq.${house_id}" >/dev/null

# A different authenticated Casa sees none of Wallace's setup rows.
for relation in accounts cards categories financial_account_balances financial_household_position; do
  cross="$(get_rel "$third_token" "$relation" "select=*&household_id=eq.${house_id}")"
  [[ "$(printf '%s' "$cross" | jq 'length')" -eq 0 ]]
done

# Anonymous access remains fail-closed: either rejected or an empty RLS result.
anon_body="$(mktemp)"
anon_status="$(curl --silent --show-error -o "$anon_body" -w '%{http_code}' \
  "${API_URL}/rest/v1/accounts?select=id&household_id=eq.${house_id}" \
  -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${SUPABASE_KEY}")"
case "$anon_status" in
  200) [[ "$(jq 'length' "$anon_body")" -eq 0 ]] ;;
  401|403) ;;
  *) echo "Unexpected anonymous app-surface response: HTTP ${anon_status}" >&2; cat "$anon_body" >&2; exit 1 ;;
esac
rm -f "$anon_body"

echo 'Marco 4 app-surface PostgREST integration gate passed.'
