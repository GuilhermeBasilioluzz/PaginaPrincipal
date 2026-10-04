#!/usr/bin/env bash
# Testa as migrations do Supabase num Postgres temporário (não precisa de Docker nem de Supabase).
# Uso: scripts/test-db.sh            (precisa dos binários do PostgreSQL 15+ instalados)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "PostgreSQL não encontrado (defina PGBIN)"; exit 1; }

WORK="$(mktemp -d)"
PORT="${PGPORT:-54329}"
# O Postgres não roda como root: usa o usuário 'postgres' quando necessário.
RUN=""
if [ "$(id -u)" = "0" ]; then chown postgres "$WORK"; RUN="runuser -u postgres --"; fi
trap '$RUN "$PGBIN/pg_ctl" -D "$WORK/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

$RUN "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -X -q -o /dev/null -v ON_ERROR_STOP=1)
"${PSQL[@]}" -c "create database hyperion_test" >/dev/null
PSQL+=(-d hyperion_test)

for f in "$ROOT"/supabase/tests/00_supabase_shim.sql "$ROOT"/supabase/migrations/*.sql \
         "$ROOT"/supabase/tests/01_helpers.sql "$ROOT"/supabase/tests/1*.sql; do
  echo "» $(basename "$f")"
  if ! "${PSQL[@]}" -f "$f" >"$WORK/out" 2>&1; then
    cat "$WORK/out"; echo "ERRO em $(basename "$f")"; exit 1
  fi
  grep -c 'ok   - ' "$WORK/out" | sed 's/^/  asserções ok: /' || true
done
echo "OK: migrations e testes passaram."
