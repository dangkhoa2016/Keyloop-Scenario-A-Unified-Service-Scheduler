# Scenario A — Public demo and reviewer handoff (2026-10-09)

## Runtime
- Device: `bd5d6d0e-c31f-4843-8330-9a5fed92a520` / `6230ad2027a4`
- Repository: `/kaggle/working/Keyloop-Scenario-A-Unified-Service-Scheduler`
- Local endpoint: `http://127.0.0.1:3000`
- Quick Tunnel URL at verification: `https://strengths-professional-phone-coordinator.trycloudflare.com`
- Tunnel binary: `/kaggle/working/keyloop-a-tunnel/cloudflared` (2026.10.0)
- Tunnel stdout: `/kaggle/working/keyloop-a-tunnel/tunnel.log`
- Tunnel PID: `/kaggle/working/keyloop-a-tunnel/tunnel.pid`
- Server PID: `/tmp/keyloop-a-server.pid`
- Server stdout: `/tmp/keyloop-a-server.log`

Quick Tunnel URLs and the Kaggle runtime are **ephemeral**. Do not use this URL as a stable production/public submission link.

## Exposure policy

The Hono server binds `127.0.0.1:3000`; cloudflared proxies it. It runs with `PUBLIC_DEMO=1` and a private high-entropy `DEMO_WRITE_TOKEN` loaded by `scripts/run-public-demo.sh`. The token file `.runtime/demo-write-token` is git-ignored, mode 600, and **must never be printed in logs, committed, included in archives, or pasted into a public notebook**.

The public **read** API reveals only synthetic seeded data and demo appointments. The public write endpoints reject missing/incorrect token with HTTP 403. For authorized booking/cancellation the UI includes a password-style token input which transmits `X-Demo-Write-Token` only for writes. Users without the token may inspect the availability/appointments demo without modifying data. This is a guarded demo, not a production authentication scheme.

## Verified live public checks

- HTTPS `GET /` → 200.
- HTTPS `GET /readyz` → 200, database `ok`.
- HTTPS unauthenticated `POST /api/v1/appointments` → 403.
- Headless Chromium via HTTPS: Vue mounted, 4 selectors, 14 slots, Tailwind applied, zero JavaScript failures and zero failed network requests.
- Headless reviewer viewport checks: 1280 × 900 and 390 × 844; no horizontal scroll, main and H1 present, first Tab focuses INPUT. **Automated** tests only; manual accessibility and physical smartphone QA remain pending.
- Local booking/cancel browser E2E, 22/22 Node tests, 10-process race and Kaggle 12-cell notebook execution were all PASS in previous verification.

## Reviewer checklist — manual

- Open the HTTPS demo on Windows desktop and Android; confirm dropdowns, date, slot selection, responsive design, touch interactions.
- Use browser keyboard only: Tab navigation, focus visibility, click/Enter/Space and Escape behavior as applicable.
- Test with Narrator on Windows 10 or another screen reader. Check text labels, button semantics and status announcements.
- If you want to create/cancel an appointment, obtain the **private** demo token directly from your authorized Kaggle environment, never share it publicly or in screenshots.
- Check cross-device clock/timezone and that 30-minute start slots respect a service's full duration.
- Record manual QA findings separately with device/browser versions; do not infer them from automated results.

## Operational commands

```bash
cd /kaggle/working/Keyloop-Scenario-A-Unified-Service-Scheduler
npm test
npm run backup
npm run evidence
PLAYWRIGHT_BROWSERS_PATH=/kaggle/working/.keyloop-playwright-browsers \
  SMOKE_URL=https://strengths-professional-phone-coordinator.trycloudflare.com \
  node scripts/public-review.js
tail -f /tmp/keyloop-a-server.log
tail -f /kaggle/working/keyloop-a-tunnel/tunnel.log
```

Restart a lost tunnel with:

```bash
cd /kaggle/working/keyloop-a-tunnel
nohup ./cloudflared tunnel --no-autoupdate --protocol http2 \
  --url http://127.0.0.1:3000 > tunnel.log 2>&1 < /dev/null &
echo $! > tunnel.pid
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' tunnel.log | head -1
```

The new URL may differ from the one above. A repository push or video submission has **not** been performed; these remain deliberate next-stage activities. No GitHub credentials are required for local development.
