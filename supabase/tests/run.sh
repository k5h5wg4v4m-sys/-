#!/usr/bin/env bash
# Локальная проверка миграций на чистом PostgreSQL 15+ (без Supabase).
# Использование: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-tabylga_test}
PSQL="psql -v ON_ERROR_STOP=1 -q -X"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d "$DB" -f tests/00_supabase_shim.sql 2>&1 | grep -v -e wal_level -e "HINT:" || true
for f in migrations/*.sql; do
  echo "migrate: $f"
  $PSQL -d "$DB" -f "$f"
done
for f in tests/[0-9][0-9]_*.sql; do
  case "$f" in tests/00_*) continue ;; esac
  echo "test: $f"
  $PSQL -d "$DB" -f "$f"
done
echo "OK: все тесты прошли"
