#!/usr/bin/env bash
set -euo pipefail

# Marco 3.12: prove that the migrated, exercised local Supabase database can be
# logically backed up and restored into a clean database in the same isolated
# PostgreSQL cluster. This never touches a remote project.

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -n 1)"
: "${DB_CONTAINER:?local Supabase database container was not found}"

DUMP_FILE="/tmp/casa-finance-backup.dump"
RESTORE_DB="casa_finance_restore_check"

printf '[Marco 3.12] database container: %s\n' "$DB_CONTAINER"

# The previous Marco 3 gates leave real household and financial facts in the
# disposable database. The backup must therefore preserve both schema and data.
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -Atqc \
  "select case when (select count(*) from public.households) > 0 and (select count(*) from public.transactions) > 0 then 'ready' else 'empty' end" \
  | grep -qx 'ready'

printf '[Marco 3.12] create logical backup\n'
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres -Fc > "$DUMP_FILE"
test -s "$DUMP_FILE"

printf '[Marco 3.12] create clean restore database\n'
docker exec "$DB_CONTAINER" dropdb -U postgres --if-exists "$RESTORE_DB"
docker exec "$DB_CONTAINER" createdb -U postgres -T template0 "$RESTORE_DB"

printf '[Marco 3.12] restore logical backup\n'
cat "$DUMP_FILE" | docker exec -i "$DB_CONTAINER" \
  pg_restore -U postgres -d "$RESTORE_DB" --exit-on-error

printf '[Marco 3.12] verify restored financial schema and facts\n'
docker exec "$DB_CONTAINER" psql -U postgres -d "$RESTORE_DB" -Atqc \
  "select case when (select count(*) from public.households) > 0 and (select count(*) from public.transactions) > 0 then 'data-ok' else 'data-missing' end" \
  | grep -qx 'data-ok'

docker exec "$DB_CONTAINER" psql -U postgres -d "$RESTORE_DB" -Atqc \
  "select case when exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname='create_and_settle_direct_expense'
        and p.prosecdef
   ) then 'rpc-ok' else 'rpc-missing' end" \
  | grep -qx 'rpc-ok'

docker exec "$DB_CONTAINER" psql -U postgres -d "$RESTORE_DB" -Atqc \
  "select case when exists (
     select 1 from pg_policies
      where schemaname='public' and tablename='households'
   ) then 'rls-ok' else 'rls-missing' end" \
  | grep -qx 'rls-ok'

printf '[Marco 3.12] backup/restore gate passed.\n'
