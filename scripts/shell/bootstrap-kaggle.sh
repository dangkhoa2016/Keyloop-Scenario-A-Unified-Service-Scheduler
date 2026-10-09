#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if test -f /mnt/workspace/mise-node-env.sh; then
  # Existing Kaggle mise-managed Node.js environment.
  source /mnt/workspace/mise-node-env.sh
fi
cd "$ROOT"
echo "NODE=$(node -v) NPM=$(npm -v)"
npm ci
if ! test -e data/scheduler.sqlite && test -f backups/scheduler-safe-backup.sqlite; then
  bash scripts/shell/restore.sh
fi
npm run db:migrate
npm run db:seed
npm test
npm run evidence
echo "BOOTSTRAP=PASS"
echo "TO_START=cd $ROOT && npm start"
