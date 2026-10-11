# Keyloop Scenario A — Unified Service Scheduler

A reproducible service-appointment scheduling system for resource-constrained automotive workshops. It allocates **qualified technicians** and **compatible service bays** for the full duration of a booking, prevents overlapping reservations, and persists decisions transactionally.

Built with **Node.js 24**, **Hono**, **SQLite** and an optional no-build **Vue 3 + Tailwind CSS** web interface. No Docker or frontend bundler is required.

> Origin: Developed for Keyloop Coding Challenge — Scenario A. The repository is also intended as a standalone engineering reference for developers and researchers interested in scheduling, transaction isolation and concurrency.

## What the project demonstrates

- **Resource-aware scheduling:** validate vehicle ownership, technician skills/shifts, service duration, dealer hours, blackouts and bay capabilities.
- **Race-safe booking:** use SQLite `BEGIN IMMEDIATE` transactions, defensive overlap triggers and half-open time intervals `[start, end)`.
- **Idempotent APIs:** replay the same booking key safely and reject a changed payload for the same key.
- **Conflict and concurrency experiments:** test two competing requests or ten independent processes in disposable databases, with one confirmed booking when only one technician/bay pair is available.
- **Persistent state and observability:** store confirmed/cancelled appointments, retain cancelled history, expose health checks and structured request IDs.
- **Reproducible live demo:** launch a protected browser-based scheduling interface from Google Colab, with independent SQLite data and optional reviewer write access.

## Choose a starting point

| Goal | Start here |
|---|---|
| Run the application locally | [Quick start](#quick-start-local) |
| Explore the REST API | [API usage](#api-usage) |
| Investigate scheduling invariants | [Architecture and scheduling model](#architecture-and-scheduling-model) |
| Reproduce booking/conflict experiments | [Automated tests and experiments](#automated-tests-and-experiments) |
| Run without a local setup | [Open the Live Demo in Colab](#live-demo-in-google-colab-or-kaggle) |
| Examine the original challenge and evaluation evidence | [Project origin and evaluation](#project-origin-and-evaluation) |
| Contribute changes | [Contributing](#contributing) |

## Quick start (local)

Prerequisites: Node.js **24+**, npm, and a local filesystem suitable for SQLite WAL.

```bash
git clone https://github.com/dangkhoa2016/Keyloop-Scenario-A-Unified-Service-Scheduler.git
cd Keyloop-Scenario-A-Unified-Service-Scheduler
npm ci
npm run db:migrate
npm run db:seed
npm test
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). By default the server listens on loopback, keeps its SQLite database at `./data/scheduler.sqlite` and uses synthetic sample records. To populate additional demonstration records in a **local environment**, run:

```bash
npm run db:seed:rich
npm run db:seed:demo
```

These seed commands are designed to avoid resetting existing appointments, but **do not run seeds against a shared/live database without first taking a backup**.

Configuration: `PORT` (default `3000`), `HOST` (default `127.0.0.1`), `DATABASE_PATH` (default `./data/scheduler.sqlite`). For a publicly exposed demo, enable controlled write access with `DEMO_WRITE_TOKEN`; do not treat this demo token as production authentication.

## Architecture and scheduling model

The service uses a single Hono application and a file-backed SQLite database:

```text
Vue browser UI ─┐
                ├── Hono HTTP API ── Booking domain ── SQLite (WAL)
REST clients ───┘                      │                    │
                                     │                    ├── FK/indexes
                        Technician skill + shift checks    ├── overlap triggers
                        Service bay capability checks      └── transactions
                        Full-duration slot validation
```

The availability endpoint is a **preview**, not a reservation. When a booking arrives, the service rechecks constraints and allocates the technician/bay pair inside an immediate transaction. Database triggers enforce no overlap for confirmed appointments, including direct SQL writes.

Bookings use half-open intervals, making adjacent reservations valid without overlap. Durations are defined by the service type; a cancellation preserves the historical row and releases capacity. Time requests use explicit UTC offsets or UTC instants; dealership-local scheduling also accounts for shift boundaries.

**Design constraints:** This implementation intentionally targets a **single host** with local SQLite. SQLite WAL must not be shared across multiple hosts over a network filesystem. Scaling to distributed scheduling requires a different database/coordination model and equivalent concurrency guarantees. The frontend's Tailwind Play CDN is a development/demo choice, not a production deployment recommendation.

Further reading: [System design](docs/SYSTEM-DESIGN.md) and [Reviewer test guide](docs/REVIEWER-TEST-GUIDE.md).

## API usage

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | Process health |
| GET | `/readyz` | Database readiness |
| GET | `/api/v1/dealerships` | List dealerships |
| GET | `/api/v1/customers` | List customers |
| GET | `/api/v1/customers/:id/vehicles` | Customer-owned vehicles |
| GET | `/api/v1/dealerships/:id/service-types` | Available service types |
| GET | `/api/v1/availability` | Full-duration resource availability |
| POST | `/api/v1/appointments` | Create an appointment |
| GET | `/api/v1/appointments` | List appointments |
| GET | `/api/v1/appointments/:id` | Read appointment |
| POST | `/api/v1/appointments/:id/cancel` | Cancel and release capacity |

Explore a running local server:

```bash
curl -fsS http://127.0.0.1:3000/readyz
curl -fsS http://127.0.0.1:3000/api/v1/dealerships
curl -fsS http://127.0.0.1:3000/api/v1/appointments/stats
```

For booking, first use the availability response to select a future valid `startAt`; send the associated customer, vehicle, dealership and service IDs with an `Idempotency-Key` header. Expect HTTP **201** on creation, **200** for an identical replay, **409** for a conflicting request, and **403** when write access is protected and a valid token is not supplied.

## Automated tests and experiments

```bash
npm test                 # full Node.js unit/integration suite
npm run test:concurrency # independent-process contention
npm run evidence         # SQLite integrity, counts, resource overlap checks
npm run backup           # transactional database backup
```

The verified backend suite contains **51 tests**. Important experiment types include resource eligibility and overlap boundaries, idempotency, SQL trigger enforcement, full HTTP behavior, server restart/persistence, DST edge cases, JSON size limits, SQLite write contention, and request/log safety.

The web UI also includes two **isolated simulations**: a two-request booking conflict and a ten-process concurrency race. Those simulations do **not** modify the live appointment database. More rigorous browser automation is in `scripts/`; some interactive browser E2E tests **do** create and cancel records, so run those tests against an isolated environment rather than shared data.

For architecture, constraints, and reproducible review scenarios, see the [System design](docs/SYSTEM-DESIGN.md) and [Reviewer test guide](docs/REVIEWER-TEST-GUIDE.md). Automated results describe specific exercised cases; they do not certify every deployment or accessibility scenario.

## Live Demo in Google Colab or Kaggle

[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/dangkhoa2016/Keyloop-Scenario-A-Unified-Service-Scheduler/blob/main/notebooks/Keyloop-Scenario-A-Scheduling-Lab-Live.ipynb)

**[Open the live scheduling notebook in Google Colab](https://colab.research.google.com/github/dangkhoa2016/Keyloop-Scenario-A-Unified-Service-Scheduler/blob/main/notebooks/Keyloop-Scenario-A-Scheduling-Lab-Live.ipynb)** · [View its source on GitHub](notebooks/Keyloop-Scenario-A-Scheduling-Lab-Live.ipynb)

The 23-cell notebook starts an **isolated Node.js + Hono + SQLite scheduling environment**, runs automated checks, and launches a temporary **Cloudflare Quick Tunnel** with the real Vue scheduling interface. A CPU runtime and Internet access are sufficient; no GPU, Docker, Google Drive or GitHub credentials are required.

The Live notebook keeps its platform-specific code in the existing source directories: [reviewer interface](public/js/Reviewer-UI.js) and [temporary tunnel helper](scripts/python/Notebook-Live-Tunnel.py). It verifies their SHA-256 checksums and copies them into its disposable sandbox. The reviewer-specific interface is intentionally distinct from the regular [web frontend](public/js/main.js); neither source is overwritten in Git by a notebook run.

1. Click **Open in Colab** above and select **Runtime → Run all**. The notebook installs dependencies and seeds synthetic data in a fresh sandbox.
2. Wait until **Cell 23 — Live Web Demo** displays **Open Live Scheduling Demo ↗**. Open that URL in your browser. The cell intentionally remains active and streams sanitized HTTP activity.
3. Browse availability and appointments. Click **Test Booking Conflict (2 requests)** to observe **1 confirmed / 1 rejected**, or **Simulate 10 Concurrent Requests** to observe **1 confirmed / 9 rejected**. These simulations use separate disposable SQLite databases and **do not** add appointments to the live list.
4. To test a **real booking and cancellation**, request a private **demo write token** from the owner. The notebook's **Cells 20–21** explain owner-only retrieval through a Terminal or a private Python cell. Never put this token into shared outputs, links or source control.
5. Click **Stop** on Cell 23 when finished, or wait for the default **15-minute session timeout**. Re-running Cell 23 starts another temporary URL against the same notebook sandbox.

**Kaggle:** Download the [Live notebook](notebooks/Keyloop-Scenario-A-Scheduling-Lab-Live.ipynb) and import it at [Kaggle Code](https://www.kaggle.com/code). Choose **CPU**, enable **Internet ON**, then **Run All**. This notebook supports both platforms, but the v11 public-tunnel browser acceptance evidence was collected from **Colab**; do not interpret that as an independent Kaggle v11 run.

**What was exercised:** The Colab v11 review included the two built-in simulations (1/1 and 1/9 confirmed/rejected) and a two-browser-tab attempt for the same slot in which one appointment was confirmed and the competing attempt saw a slot-unavailable message. HTML snapshots document those visible outcomes; they do not by themselves establish millisecond-level simultaneous POST arrivals. Booking write access is protected, and real demo data lives only in the temporary sandbox.

**Safety and limitations:** The Cloudflare address is ephemeral and should not be used as permanent hosting. The write token is demonstration access control, not full production authentication. The frontend uses browser-loaded Vue/Tailwind resources, so Internet access is required. Never enter actual customer data or production credentials.

## Repository layout

```text
src/             HTTP API, database schema, booking domain
public/          Optional Vue/Tailwind browser interface
tests/           Resource rules, concurrency, security and persistence tests
scripts/         Organized CLI utilities, browser checks, shell helpers and Python tunnel
notebooks/       Executable Kaggle / Colab scheduling lab
docs/            Maintained system design and reviewer testing guide
.github/         CI, dependency updates and issue/PR templates
```

## Contributing

Issues and pull requests are welcome for reproducible defects, new scheduling scenarios, test coverage, accessibility and operational improvements. Include the relevant Node version, a minimal synthetic reproduction and automated evidence. Run `npm test` before submitting a PR, and follow [the pull request template](.github/PULL_REQUEST_TEMPLATE.md).

Do not commit local SQLite data, access tokens, credentials or private runtime artifacts. The `.github/workflows/ci.yml` workflow runs the Node test suite and validates the notebook JSON on pull requests.

## Project origin and evaluation

This system originated as **Keyloop Coding Challenge — Scenario A: Unified Service Scheduler**. Its original minimum requirements were appointment requests, checking technician/service-bay availability for the full service duration, and persisting the confirmed allocation. The project also includes additional demonstrations of contention, cancellation, idempotency, browser usability and SQLite integrity.

For a structured evaluation walkthrough, see the [Reviewer test guide](docs/REVIEWER-TEST-GUIDE.md) and the browser route `/reviewer-guide`.

## Limitations and future directions

- Single-host SQLite and process-local behavior, not a distributed reservation platform.
- Tailwind/browser CDN availability is needed to render the demo UI.
- The demo token is not full user authentication/authorization.
- No production-grade notification pipeline, advanced metrics dashboard or multi-host coordination.
- Manual screen-reader and physical-device accessibility testing is not implied by automated browser/axe checks.
- Potential research extensions: alternative resource assignment heuristics, fairness, time-window optimization, throughput benchmarks and multi-tenant workload models.

## Authorship

Maintained by **Đăng Khoa** (i.am@dangkhoa.dev). AI-assisted development was used during implementation; design decisions, testing and responsibility for the resulting repository remain with the maintainer.
