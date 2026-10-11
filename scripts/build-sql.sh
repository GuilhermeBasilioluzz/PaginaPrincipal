#!/usr/bin/env bash
# Junta todas as migrations num único arquivo para colar no SQL Editor do Supabase (supabase/all_migrations.sql).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "-- HYPERION SYSTEM — todas as migrations em ordem. GERADO por scripts/build-sql.sh: não edite aqui."
echo "-- Cole tudo no Supabase → SQL Editor → New query → Run. Rode UMA vez num projeto novo."
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo
  echo "-- =================================================================================="
  echo "-- $(basename "$f")"
  echo "-- =================================================================================="
  cat "$f"
done
