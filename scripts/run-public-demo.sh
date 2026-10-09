#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export HOST=127.0.0.1 PORT=3000 PUBLIC_DEMO=1
export DEMO_WRITE_TOKEN="$(cat .runtime/demo-write-token)"
exec node src/server.js
