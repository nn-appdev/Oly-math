#!/usr/bin/env bash
# Menjalankan uji RLS pada klaster PostgreSQL sementara (tidak menyentuh basis data mana pun yang ada).
# Prasyarat: biner PostgreSQL (initdb, pg_ctl, psql) tersedia. Tidak memerlukan Supabase.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "initdb tidak ditemukan. Setel PGBIN ke folder bin PostgreSQL." >&2; exit 2; }

if [ "$(id -u)" = "0" ]; then
  if id postgres >/dev/null 2>&1; then PGUSER_OS=postgres; else PGUSER_OS=claude; fi
  run_as() { runuser -u "$PGUSER_OS" -- "$@"; }
else
  PGUSER_OS="$(id -un)"
  run_as() { "$@"; }
fi

WORK="$(mktemp -d)"
chmod 755 "$WORK"
[ "$(id -u)" = "0" ] && chown "$PGUSER_OS" "$WORK"
DATA="$WORK/data"
SOCK="$WORK"

cleanup() {
  run_as "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_as "$PGBIN/initdb" -D "$DATA" -A trust -U postgres >/dev/null
run_as "$PGBIN/pg_ctl" -D "$DATA" -o "-c listen_addresses='' -c unix_socket_directories='$SOCK'" -w -l "$WORK/pg.log" start >/dev/null

psql_run() { run_as "$PGBIN/psql" -h "$SOCK" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "==> Menyiapkan peran dan skema auth tiruan"
psql_run -f - < "$ROOT/supabase/tests/00_bootstrap.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> Migrasi: $(basename "$f")"
  psql_run -f - < "$f"
done

echo "==> Menjalankan ulang migrasi (uji idempotensi)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql_run -f - < "$f"
done

echo "==> Menjalankan uji RLS"
psql_run -f - < "$ROOT/supabase/tests/rls.test.sql"
echo "==> Menjalankan uji validasi soal dan kurikulum"
psql_run -f - < "$ROOT/supabase/tests/questions.test.sql"
echo "==> Menjalankan uji seed"
export MQ_ROOT="$ROOT"
(cd "$ROOT/supabase/tests" && psql_run -f seed.test.sql)
echo "==> Menjalankan uji latihan siswa"
psql_run -f - < "$ROOT/supabase/tests/practice.test.sql"
echo "==> Semua uji RLS lulus"
