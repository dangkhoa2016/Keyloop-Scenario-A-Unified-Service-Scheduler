# Scenario A — Verified implementation status (2026-10-09)

| Milestone | Actual verified state | Evidence and remaining limits |
|---|---|---|
| M0 Hono + no-build Vue frontend | Implemented and verified | Node 24.21, Hono GET /healthz, GET / and GET /js/main.js returned 200; Playwright Vue mounted and Tailwind applied |
| M1 SQLite migrations, seed, backup and recovery | Implemented and verified | Schema migration registry 001_initial, WAL, FK, constraints and triggers; 2 dealers, 4 bays, 4 technicians; safe online SQLite backup, restored copy integrity ok with 3 demo appointments |
| M2 Availability engine / REST API | Implemented and tested | Full-interval skills, shifts, hours, bay compatibility, blackouts; positive/negative automated tests |
| M3 Booking, idempotency and true multi-process concurrency | Implemented and tested | 22/22 Node tests; 10 workers synchronized by ready barrier => exactly 1 accepted and 9 conflicts; HTTP 201/200/409 and DB proof |
| M4 Vue 3 + Tailwind CDN reviewer UI | Implemented and headless-tested | Playwright Desktop 1280px and Mobile 390px screenshot, zero JS/network errors, 14 free slots, browser create+cancel success; independent manual accessibility review pending |
| M5 Observability and hardening | Partially implemented | Request IDs, structured timing logs, demo write token for external exposure, 0 npm-audit vulnerabilities at test time; broader auth/rate limits/load tests not complete |
| M6 Reviewer evidence, docs and Kaggle notebook | Largely implemented | Original full System Design/Implementation Plan copied with verified SHA256; 12-cell reviewer notebook executed end-to-end successfully; evidence scripts and browser screenshots generated; public GitHub repository not created |
| M7 Video and final submission | Pending | Record a 5–10 min demo and finalize a reviewed GitHub repository |

## Verifiable acceptance summary
- **A-1** Resource-constrained request: PASS in backend and browser E2E.
- **A-2** Real-time availability: PASS in domain and HTTP tests, with transaction-time recheck.
- **A-3** Confirmed persistent appointment: PASS including restart/read, SQLite backup and independent-process race verification.

The backend was selected as the fully implemented service layer; frontend is a working companion layer without a build tool. All test evidence is synthetic. Manual accessibility, externally reachable public URL and official submission are not yet claimed complete.

## Evidence paths
- `evidence/final-node-tests.log`
- `evidence/http-smoke.json`, `evidence/runtime-evidence.json`
- `evidence/browser-smoke.json`, `evidence/browser-e2e.json`
- `evidence/browser-desktop.png`, `evidence/browser-mobile.png`
- `evidence/browser-booked.png`, `evidence/browser-cancelled.png`
- `backups/scheduler-safe-backup.sqlite` (offline-consistent SQLite backup)

## Restore and verify
Run `bash scripts/bootstrap-kaggle.sh` from the portable extracted source on a new Kaggle environment. Never overwrite an existing database. Copying a live WAL database file directly is unsafe; use `npm run backup` for online snapshots.

## Demo data / reviewer guide enhancement (2026-10-09)
- Expanded persistent synthetic dataset to 6 dealerships, 20 customers, 20 vehicles, 32 technicians, 32 service bays, 10 service types and 10 skills.
- Appointments: 15 total (12 confirmed, 3 cancelled) after idempotent demo fixture run; existing 3 preserved.
- `npm run db:seed:rich` and `npm run db:seed:demo` are repeatable and preserve existing appointments.
- Reviewer manual: `docs/REVIEWER-TEST-GUIDE.md`; browser page `/reviewer-guide`, linked from the homepage.
- Tests increased to 26/26 PASS. Public browser smoke and desktop/mobile viewport checks passed.
- Cloudflare Quick Tunnel URL is temporary; do not claim stable public hosting or completed manual accessibility QA.
