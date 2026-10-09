# Keyloop Scenario A — Unified Service Scheduler

An assessment implementation of **resource-constrained vehicle service scheduling**, with one full Node.js + Hono service, persistent SQLite3, and an optional no-build Vue 3 / Tailwind browser-CDN interface.

## Acceptance requirements

- A-1: Request an appointment for an existing vehicle, service type and dealership at a chosen time.
- A-2: Verify **both** a qualified technician and compatible service bay are free for the **entire** service duration.
- A-3: Persist a confirmed appointment linking customer, vehicle, dealership, service, technician and bay.

## Stack and scope

- Node.js 24 (verified on Kaggle, 2026-10-09); JavaScript ESM, `hono`, `@hono/node-server`.
- SQLite3 via `better-sqlite3`, WAL, foreign keys, indexes and defensive overlap triggers.
- Vue 3 ESM and Tailwind CSS v4 browser CDN. **No Vite, Webpack, bundler, Docker or frontend build step.**
- Single Node process and HTTP port; one file-backed SQLite database on local disk.
- Tailwind Play CDN is intended for development/demo only, not a production deployment.
- All customers and vehicle data are synthetic.

## Start from clean checkout

```bash
npm ci
npm run db:migrate
npm run db:seed
npm test
npm start
```

Open http://127.0.0.1:3000 (or view via your own authorized tunnel). The demo service is local-only by default. For external access, set `HOST=0.0.0.0` and `DEMO_WRITE_TOKEN` to a high-entropy non-empty token in the process environment. The browser has a password-style input for this demo token; it is kept in page memory and sent only with write requests. Without a token, requests to change data are denied when `HOST=0.0.0.0`. Do not publish or commit the token.

Configuration defaults: `PORT=3000`, `HOST=127.0.0.1`, `DATABASE_PATH=./data/scheduler.sqlite`. On Kaggle keep code/data under `/kaggle/working`.

## Scripts

```bash
npm run db:migrate
npm run db:seed          # INSERT OR IGNORE; does not reset existing appointments
npm test                 # full automated suite
npm run test:concurrency # forked independent SQLite processes
npm run backup           # transactional SQLite backup
npm run evidence         # checks and machine-readable evidence
npm start
```

## API reference

- `GET /healthz` process liveness; `GET /readyz` SQLite readiness.
- `GET /api/v1/dealerships`; `GET /api/v1/customers`.
- `GET /api/v1/customers/:id/vehicles`.
- `GET /api/v1/dealerships/:id/service-types`.
- `GET /api/v1/availability?dealershipId=dlr_001&serviceTypeId=svc_brake&date=YYYY-MM-DD`.
- `POST /api/v1/appointments` requires `Idempotency-Key` and JSON body.
- `GET /api/v1/appointments`; `GET /api/v1/appointments/:id`.
- `POST /api/v1/appointments/:id/cancel`.

Example request (choose a future open weekday):

```bash
curl -i http://127.0.0.1:3000/api/v1/appointments \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: reviewer-example-001' \
  -d '{"customerId":"cus_001","vehicleId":"veh_001","dealershipId":"dlr_001","serviceTypeId":"svc_brake","startAt":"2026-10-12T09:00:00+07:00"}'
```

## Correctness and database policy

- Every interval is half-open `[start, end)`. Duration is derived from `service_types`.
- `book()` wraps the qualification, availability recheck, assignment and insert inside `better-sqlite3` `transaction.immediate()`.
- `appointment_guard_insert` and `appointment_guard_update` SQL triggers prevent overlapping confirmed bookings for the same technician or service bay, including direct writes.
- Skills (all required), shifts, dealership opening hours, blackouts, bay capabilities, customer/vehicle ownership and active status are checked.
- Idempotency keys and payload fingerprints prevent duplicate creates across retries. Cancelled appointments remain stored and release resources.
- Tests spawn ten independent child Node processes against a shared test SQLite file; expect exactly one `201`, nine `409` responses for a single technician/bay, and one confirmed DB row.

This SQLite design intentionally targets **one host with a local filesystem**. Do not place a WAL database on a shared network filesystem; a horizontally distributed production scheduler should use an appropriate networked relational DB and equivalent exclusion/locking policies.

## Full design documents

See `docs/KEYLOOP-SCENARIO-A-SYSTEM-DESIGN-2026-10-09.md` and `docs/KEYLOOP-SCENARIO-A-IMPLEMENTATION-PLAN-2026-10-09.md` (original dated planning artifacts), plus `docs/IMPLEMENTATION-STATUS.md` for the observed implementation state. Kaggle reviewer notebook: `notebooks/Scenario_A_Reviewer_Demo.ipynb`.

## Browser automation (optional QA)

```bash
npx playwright install chromium
npx playwright install-deps chromium # on a Linux machine missing system browser libs
npm run test:browser
npm run test:browser:e2e
```

If browsers were installed into a custom cache, set `PLAYWRIGHT_BROWSERS_PATH` to that cache directory when running these commands. These are **tests**, not a frontend build tool. Screenshots and machine-readable results are written under ignored `evidence/`.

## Recovery on a fresh Kaggle session

Use `bash scripts/bootstrap-kaggle.sh` after extracting the portable source archive. It installs dependencies, restores the transactional SQLite backup only if no database exists, runs migration/seed and tests. This script never overwrites an existing database.

## Reviewer test guide

Open the built-in **/reviewer-guide** page linked from the homepage, or read the full test manual at `docs/REVIEWER-TEST-GUIDE.md`. Expand and idempotently repopulate the demo using `npm run db:seed:rich` and `npm run db:seed:demo`. They preserve existing appointment rows.

## Reviewer flow

1. Start service and inspect `/readyz`.
2. Select Central Auto Service, Demo Customer A, Honda Accord, Brake Inspection and next open weekday.
3. Inspect available 30-minute start slots. Confirm one booking; view assigned technician and bay.
4. Refresh the page: stored appointment remains visible.
5. Run `npm run test:concurrency` and inspect results; demonstrate only one competing request is successful.
6. Cancel appointment, refresh available slots, make a fresh booking.
7. Review SQLite integrity, evidence report, tests and the design trade-offs.

## AI Collaboration Narrative

**Strategy:** We used an AI coding assistant to turn the source acceptance criteria into a traceable design, schema, resource eligibility rules, tests and reviewer interface. The assistant was directed to isolate the business invariants in SQL and implement race-safe booking using SQLite immediate transactions, rather than treating an availability preview as a reservation.

**Verification / corrections:** An initial test run failed because its generated fixture date was Sunday, outside seeded dealership hours. The fixture was corrected to select a valid future Monday; tests were rerun. A second integration review found that the frontend sends UTC ISO timestamps from the availability endpoint, while the first time-parser version demanded the dealership-local offset. The parser was adjusted to accept valid absolute times with an explicit offset, and an HTTP regression test was added. Every PASS in the evidence is based on executable tests, not a proposed outcome.

**Ownership:** Architectural decisions, risk assessment, and code acceptance remain the developer's responsibility. Unverified browser visual QA and deployment details must not be described as completed. Full test output should be captured in `evidence/` when preparing reviewer artifacts.

## Known limitations / next work

- Automated desktop/mobile screenshot and browser booking/cancel QA passed; independent manual keyboard/screen-reader accessibility review is still pending.
- Browser CDN availability is required for first load; no offline bundle.
- No production authentication, session control, rate-limiting, notifications, or multi-host SQLite coordination.
- Complete submission docs, Kaggle demonstration notebook and 5–10 minute video remain to be finalized.

## Friendly demo access handling

On public tunnels, browsing is open but Create/Cancel require the private demo write token. The page exposes a read-only explanation, token verification action, disabled write buttons when no token is supplied, and contextual resolution messages for invalid/missing tokens. The read-only API endpoint is `GET /api/v1/demo-access`; `POST /api/v1/demo-access/verify` checks a token without changing bookings.

## Interactive simulation: booking conflict and 10 concurrent requests

The homepage now provides **Test Booking Conflict (2 requests)** and **Simulate 10 Concurrent Requests**. Each invokes 'POST /api/v1/demo/simulate' with a fixed 'mode' of 'conflict' or 'concurrent' (no user-controlled SQL or subprocess count). The demo constructs a **new temporary SQLite database** with the same migrations and baseline seed, then has the existing scheduler reserve one qualified technician and one compatible service bay for a 90-minute Brake Inspection.

The conflict scenario submits two competing requests sequentially. The concurrent scenario releases ten separate Node.js workers together after a ready barrier. Exactly one request must confirm; all others must reject with 'SLOT_UNAVAILABLE'. The response includes actual HTTP-style decision statuses, explanations, resource identifiers, integrity and confirmed-row counts.

**Important:** These are sandboxed demonstrations, not writes to production demo appointments. No demo write token is required. Requests are rate-limited (one running simulation, 20-second cooldown per caller). Automated evidence: 'tests/simulation.test.js', 'scripts/simulation-browser-test.js'.

## Human-readable booking confirmation

After a successful booking the frontend displays a structured appointment confirmation with customer, vehicle, service and duration, dealership, local start/end times, assigned technician and service bay, and a summary of the resource checks. Technical IDs appear in an expandable reviewer-only details area rather than in the main success text. The API provides an additional `details` object on appointment responses; existing technical IDs and status fields remain unchanged for compatibility. Browser proof: `scripts/confirmation-browser-test.js`, which books into an isolated temporary SQLite database.
