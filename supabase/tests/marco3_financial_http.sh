#!/usr/bin/env bash
set -euo pipefail

# Marco 3.05: prove a real direct expense through Auth/JWT/PostgREST and canonical RPCs.
# Buyer, economic responsibility, account ownership and funder are intentionally distinct.
API_URL="${API_URL:-http://127.0.0.1:54321}"
SUPABASE_KEY="${PUBLISHABLE_KEY:-${ANON_KEY:-}}"
: "${SUPABASE_KEY:?PUBLISHABLE_KEY or ANON_KEY is required}"
PASSWORD='Marco3-financial-http-42!'
RUN_ID="${GITHUB_RUN_ID:-local}-$(date +%s)-$RANDOM"
TODAY='2026-09-07'

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

rest_post() {
  local token="$1" table="$2" body="$3"
  curl --fail-with-body --silent --show-error -X POST "${API_URL}/rest/v1/${table}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d "$body"
}

rest_get() {
  local token="$1" path="$2"
  curl --fail-with-body --silent --show-error "${API_URL}/rest/v1/${path}" \
    -H "apikey: ${SUPABASE_KEY}" -H "Authorization: Bearer ${token}"
}

wallace_email="wallace-fin-${RUN_ID}@example.invalid"
guilherme_email="guilherme-fin-${RUN_ID}@example.invalid"
wallace_json="$(auth_signup "$wallace_email")"
guilherme_json="$(auth_signup "$guilherme_email")"
wallace_token="$(printf '%s' "$wallace_json" | jq -er '.access_token')"
guilherme_token="$(printf '%s' "$guilherme_json" | jq -er '.access_token')"
wallace_user_id="$(printf '%s' "$wallace_json" | jq -er '.user.id')"
guilherme_user_id="$(printf '%s' "$guilherme_json" | jq -er '.user.id')"

rpc "$wallace_token" bootstrap_household '{"household_name":"Casa Finance HTTP","household_currency":"BRL","household_timezone":"America/Sao_Paulo"}' >/dev/null
house_json="$(rest_get "$wallace_token" 'households?select=id,name')"
household_id="$(printf '%s' "$house_json" | jq -er '.[0].id')"

invitation_json="$(rpc "$wallace_token" create_household_invitation "{\"invited_email\":\"${guilherme_email}\"}")"
invitation_token="$(printf '%s' "$invitation_json" | jq -er '.[0].token')"
rpc "$guilherme_token" accept_household_invitation "{\"invitation_token\":\"${invitation_token}\"}" >/dev/null

members_json="$(rest_get "$wallace_token" "household_members?select=id,profile_id,role&household_id=eq.${household_id}&deactivated_at=is.null")"
wallace_member_id="$(printf '%s' "$members_json" | jq -er --arg id "$wallace_user_id" '.[] | select(.profile_id==$id) | .id')"
guilherme_member_id="$(printf '%s' "$members_json" | jq -er --arg id "$guilherme_user_id" '.[] | select(.profile_id==$id) | .id')"

# Setup data is created through the same authenticated PostgREST surface available to the app.
account_json="$(rest_post "$wallace_token" accounts "{\"household_id\":\"${household_id}\",\"owner_member_id\":\"${wallace_member_id}\",\"name\":\"Conta Wallace E2E\",\"type\":\"checking\",\"institution\":\"Teste\",\"opening_balance\":0,\"opened_at\":\"${TODAY}\"}")"
account_id="$(printf '%s' "$account_json" | jq -er '.[0].id')"
category_json="$(rest_post "$wallace_token" categories "{\"household_id\":\"${household_id}\",\"name\":\"Mercado E2E ${RUN_ID}\",\"type\":\"expense\"}")"
category_id="$(printf '%s' "$category_json" | jq -er '.[0].id')"

# Canonical opening position: R$ 1.000 of real available cash in Wallace's account.
rpc "$wallace_token" record_account_opening_position "{\"p_household_id\":\"${household_id}\",\"p_account_id\":\"${account_id}\",\"p_amount\":1000,\"p_effective_date\":\"${TODAY}\",\"p_description\":\"Saldo inicial E2E\"}" >/dev/null

# One R$120 expense. Wallace bought it, the account belongs to Wallace, both are economically
# responsible 50/50, but Guilherme is explicitly the funder. None of those roles is inferred.
splits="[{\"member_id\":\"${wallace_member_id}\",\"percentage\":50,\"amount\":60},{\"member_id\":\"${guilherme_member_id}\",\"percentage\":50,\"amount\":60}]"
expense_body="{\"p_household_id\":\"${household_id}\",\"p_description\":\"Mercado real E2E\",\"p_amount\":120,\"p_transaction_date\":\"${TODAY}\",\"p_category_id\":\"${category_id}\",\"p_buyer_member_id\":\"${wallace_member_id}\",\"p_source_account_id\":\"${account_id}\",\"p_funder_member_id\":\"${guilherme_member_id}\",\"p_splits\":${splits},\"p_paid_at\":\"2026-09-07T12:00:00-03:00\",\"p_notes\":\"Marco 3.05\"}"
transaction_id="$(rpc "$wallace_token" create_and_settle_direct_expense "$expense_body" | jq -er '.')"

# Economic fact exists exactly once and retains the explicit buyer.
tx_json="$(rest_get "$wallace_token" "transactions?select=id,type,status,amount,buyer_member_id,economic_state,realized_amount&id=eq.${transaction_id}")"
[[ "$(printf '%s' "$tx_json" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$tx_json" | jq -r '.[0].type')" == 'expense' ]]
[[ "$(printf '%s' "$tx_json" | jq -r '.[0].status')" == 'paid' ]]
[[ "$(printf '%s' "$tx_json" | jq -r '.[0].amount')" == '120.00' || "$(printf '%s' "$tx_json" | jq -r '.[0].amount')" == '120' ]]
[[ "$(printf '%s' "$tx_json" | jq -r '.[0].buyer_member_id')" == "$wallace_member_id" ]]

allocations="$(rest_get "$wallace_token" "economic_allocations?select=responsible_member_id,percentage,amount&transaction_id=eq.${transaction_id}&order=allocation_order")"
[[ "$(printf '%s' "$allocations" | jq 'length')" -eq 2 ]]
[[ "$(printf '%s' "$allocations" | jq '[.[].amount|tonumber] | add')" == '120' ]]
[[ "$(printf '%s' "$allocations" | jq '[.[].percentage|tonumber] | add')" == '100' ]]

funding="$(rest_get "$wallace_token" "funding_events?select=funder_member_id,source_account_id,amount&financed_transaction_id=eq.${transaction_id}")"
[[ "$(printf '%s' "$funding" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$funding" | jq -r '.[0].funder_member_id')" == "$guilherme_member_id" ]]
[[ "$(printf '%s' "$funding" | jq -r '.[0].source_account_id')" == "$account_id" ]]
[[ "$(printf '%s' "$funding" | jq -r '.[0].amount|tonumber')" == '120' ]]

# Cash leaves only once: one realized expense_payment movement for R$120.
movements="$(rest_get "$wallace_token" "money_movements?select=kind,state,amount,source_account_id&related_transaction_id=eq.${transaction_id}")"
[[ "$(printf '%s' "$movements" | jq 'length')" -eq 1 ]]
[[ "$(printf '%s' "$movements" | jq -r '.[0].kind')" == 'expense_payment' ]]
[[ "$(printf '%s' "$movements" | jq -r '.[0].state')" == 'realized' ]]
[[ "$(printf '%s' "$movements" | jq -r '.[0].amount|tonumber')" == '120' ]]

# Guilherme, as another member of the same Casa, sees the same economic fact.
guilherme_tx="$(rest_get "$guilherme_token" "transactions?select=id,amount&id=eq.${transaction_id}")"
[[ "$(printf '%s' "$guilherme_tx" | jq 'length')" -eq 1 ]]

echo 'Marco 3.05 real direct-expense gate passed.'
