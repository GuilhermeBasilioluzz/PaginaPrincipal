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
         "$ROOT"/supabase/tests/01_helpers.sql "$ROOT"/supabase/tests/[12]*.sql; do
  echo "» $(basename "$f")"
  if ! "${PSQL[@]}" -f "$f" >"$WORK/out" 2>&1; then
    cat "$WORK/out"; echo "ERRO em $(basename "$f")"; exit 1
  fi
  grep -c 'ok   - ' "$WORK/out" | sed 's/^/  asserções ok: /' || true
done

# o arquivo único para colar no Supabase precisa refletir as migrations atuais
"$ROOT/scripts/build-sql.sh" > "$WORK/all.sql"
cmp -s "$WORK/all.sql" "$ROOT/supabase/all_migrations.sql" || { echo "ERRO: supabase/all_migrations.sql está desatualizado. Rode scripts/build-sql.sh > supabase/all_migrations.sql"; exit 1; }

# a loja de demonstração precisa rodar (duas vezes: a segunda não duplica)
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('99999999-0000-0000-0000-000000000009', 'demo@teste.com')" >/dev/null
sed "s/COLOQUE-SEU-EMAIL@AQUI.COM/demo@teste.com/" "$ROOT/supabase/seed_demo.sql" > "$WORK/seed.sql"
"${PSQL[@]}" -f "$WORK/seed.sql" >/dev/null 2>&1 || { echo "ERRO: seed_demo.sql falhou"; "${PSQL[@]}" -f "$WORK/seed.sql"; exit 1; }
"${PSQL[@]}" -f "$WORK/seed.sql" >/dev/null 2>&1 || { echo "ERRO: seed_demo.sql não é repetível"; exit 1; }
N=$(psql -h "$WORK" -p "$PORT" -U postgres -d hyperion_test -X -At -c "select (select count(*) from stores where slug='demo') || '/' || (select count(*) from products) || '/' || (select count(*) from catalog_products('demo'))")
[ "$N" = "1/6/6" ] || { echo "ERRO: demo deveria ter 1 loja, 6 peças e 6 no catálogo (veio $N)"; exit 1; }
echo "  demonstração: loja /demo com 6 peças visíveis no catálogo ($N)"
echo "OK: migrations e testes passaram."
