# UI-13 — Reviewer readiness and final acceptance

Date: 2026-10-10 (Asia/Ho_Chi_Minh)

## Acceptance state

- Scenario A minimum A-1/A-2/A-3: Node/Hono/SQLite booking, qualified technician and compatible bay over the full duration, transactional persistence; validated by the automated unit/integration suite and prior manual booking/cancel tests.
- UI-06 cancel & slot restoration: prior browser HTML captures 556–559, live SQLite read-only check and availability API PASS.
- UI-08 Demo token: Chromium acceptance PASS; user also reported manually entering a demo token.
- UI-09 filtered appointments: Chromium PASS.
- UI-10 keyboard/focus/modal: 33/33 Chromium PASS.
- UI-11 responsive/touch: 8/8 Playwright emulation PASS. Physical Android verification skipped at user's request; **not** claimed.
- UI-12 accessibility & contrast: axe scan at mobile/desktop main+modal: 0 violations. Manual screen reader/physical device accessibility **not verified in this session**.
- T21 monitoring/operational enhancements beyond baseline scope remain PARTIAL per historical audit.

## Safety and documentation

- Private token in `.runtime/demo-write-token` must not be logged/committed/published. Never include secrets in screenshots or notebook cell outputs.
- Native SQLite backup generated with `npm run backup` (transactional backup API, includes live appointments).
- The Kaggle reviewer notebook includes actual POST booking, so it must **only** run in an isolated disposable checkout/database. The notebook now automatically creates a fresh isolated source checkout, SQLite file, and randomly allocated loopback port. No shared server or live database is reused.
- Cloudflare Quick Tunnel URLs are ephemeral; the dated 2026-10-09 handoff URL is historical.
- Browser acceptance scripts are for a locally running demo and some assert exact snapshot counts; do not interpret those as fixture-independent forever.
- No video recording, submission upload, public GitHub remote or push has been completed/verified during this UI-13 round.

## Reviewer sequence

1. Inspect README architecture constraints; read `docs/REVIEWER-TEST-GUIDE.md`.
2. Launch localhost securely via `bash scripts/run-public-demo.sh` in an authorized runtime; confirm `GET /readyz` and `GET /api/v1/appointments/stats`.
3. Inspect homepage, availability, protected booking UX, and the sandbox concurrency simulator (no live DB writes from simulation).
4. Verify code with `npm test` and `npm run evidence`; confirm resource overlap check and SQLite integrity.
5. For browser QA, use scripts `ui08` through `ui12`; keep axe-core available for UI-12 (`npm install --no-save --package-lock=false --ignore-scripts axe-core` if needed).
6. Do not execute the destructive notebook against the shared live database. Execute its complete walk-through only on an isolated disposable clone/database, with an isolated local server.
7. Capture video and prepare a sanitized GitHub submission only after final review.

## Outstanding before final submission

- Isolated full Kaggle notebook execution: **PASS on 2026-10-10**, all 8/8 code cells executed via nbclient; 51/51 tests PASS inside sandbox; HTTP booking statuses 201/200/409/200; conflict simulation 1/1 and concurrency 1/9; SQLite integrity ok and server stopped. See `evidence/Scenario_A_Reviewer_Demo-isolated-executed.ipynb` and `evidence/notebook-isolated-execution-status.json`.
- Reviewer video capture and submission instructions/repository setup.
- Manual Windows Narrator and physical Android QA remain unverified/waived; do not label WCAG certified.
- Final Git commit and push not yet performed. Preserve all existing uncommitted script permission changes and audit them separately before commit.
