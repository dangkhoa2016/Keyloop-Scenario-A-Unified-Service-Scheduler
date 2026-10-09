#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${2:-$ROOT/data/scheduler.sqlite}"
SOURCE="${1:-$ROOT/backups/scheduler-safe-backup.sqlite}"
test -f "$SOURCE" || { echo "RESTORE=FAIL missing backup: $SOURCE" >&2; exit 2; }
if test -e "$TARGET" || test -e "$TARGET-wal" || test -e "$TARGET-shm"; then
  echo "RESTORE=BLOCKED existing database or WAL present; will not overwrite" >&2
  exit 3
fi
mkdir -p "$(dirname "$TARGET")"
cp -p "$SOURCE" "$TARGET"
cd "$ROOT"
RESTORE_TARGET="$TARGET" node -e 'const D=require("better-sqlite3");const d=new D(process.env.RESTORE_TARGET,{readonly:true});const v=d.pragma("integrity_check",{simple:true});console.log("RESTORED_INTEGRITY="+v+" APPOINTMENTS="+d.prepare("SELECT count(*) n FROM appointments").get().n);d.close();if(v!=="ok")process.exitCode=1;'
