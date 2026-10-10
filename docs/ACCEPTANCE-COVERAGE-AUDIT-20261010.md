# Scenario A — Acceptance Coverage Audit

**Execution:** 2026-10-10 ICT · Kaggle device `bd5d6d0e-c31f-4843-8330-9a5fed92a520`.
**Base Git revision:** `0254de8`. **Result:** `npm test` 41/41 PASS, 0 failed, 0 skipped. Tests use disposable SQLite fixture files, not the shared live database.
**Live safety:** 44 appointments, `PRAGMA integrity_check=ok`, no overlapping confirmed technician/bay assignments before/after regression. Fresh native SQLite backup completed with 44 appointments.

## T01–T21 acceptance traceability

| ID | Requirement | Status | Grounded evidence / limitation |
|---|---|---|---|
| T01 | Valid persistent booking | PASS | `tests/booking.test.js` persistent linked appointment, `tests/http.test.js` HTTP 201 |
| T02 | Technician qualification | PASS | `tests/rules.test.js` wrong skills |
| T03 | Technician free, bay occupied | PASS | `tests/acceptance-gaps.test.js` bay-only blackout, 409-like domain conflict |
| T04 | Bay free, qualified technician occupied | PASS | `tests/acceptance-gaps.test.js` technician-only blackout |
| T05 | Interval partial overlaps left/right | PASS | `tests/acceptance-gaps.test.js` two overlap directions |
| T06 | Boundary adjacency | PASS | `tests/rules.test.js` half-open intervals |
| T07 | Dealer hours and technician full shift | PASS | `tests/rules.test.js` hours; `tests/acceptance-gaps.test.js` shift ending at lunch |
| T08 | Technician and bay blackouts | PASS | `tests/rules.test.js` distinct cases |
| T09 | Duration originates in service_types | PASS | `tests/acceptance-gaps.test.js` 45-minute persisted interval despite client durationMinutes |
| T10 | Missing vehicle, wrong owner; malformed booking fields | PARTIAL | `tests/acceptance-gaps.test.js` invalid vehicle/owner, `tests/http.test.js` missing key; full invalid customer/field matrix pending |
| T11 | Independent SQLite processes | PASS | `tests/two-process-acceptance.test.js` exactly one winner with distinct keys |
| T12 | 10-process synchronized contention | PASS | `tests/concurrency.test.js` and `tests/simulation.test.js` |
| T13 | Same-key replay | PASS | `tests/booking.test.js`, `tests/http.test.js`, `tests/two-process-acceptance.test.js` |
| T14 | Same key, changed payload | PASS | `tests/booking.test.js` conflict |
| T15 | Cancel then rebook | PASS | `tests/booking.test.js` |
| T16 | Direct SQL overlap INSERT and UPDATE | PASS | `tests/booking.test.js` insert, `tests/acceptance-gaps.test.js` update |
| T17 | Server restart and HTTP GET persistence | PARTIAL | `tests/rules.test.js` confirms persistence across DB connection reopen; automated full server restart pending |
| T18 | Native SQLite online backup → restore | PASS | `tests/acceptance-gaps.test.js`; independently opens restored SQLite, checks count, row, integrity |
| T19 | Invalid timezone / ambiguous DST | PARTIAL | `tests/acceptance-gaps.test.js` malformed ISO/no offset/impossible numeric offset; DST gap/fold rejection not yet verified |
| T20 | Vue keyboard/mobile/stale-slot | PARTIAL | `scripts/browser-smoke.js`, `scripts/confirmation-browser-test.js`, `scripts/simulation-live-isolation-browser-test.js`; manual a11y and stale-slot E2E pending |
| T21 | Sanitized request logs / metrics | PARTIAL | Request IDs/status exist in `src/app.js`; systematic redaction/logging and metric assertions pending |

**Coverage verdict:** Automated core transaction/resource acceptance is materially stronger; **not** all 21 test IDs are fully closed. PASS here means the listed concrete assertion was executed and satisfied, not every conceivable negative variant.

## Failures and fixes retained

1. **Initial new-suite run:** 8 PASS / 1 FAIL: T19 allowed `2030-01-07T09:00:00+99:00` because Luxon parsed it and the previous regex permitted arbitrary 2-digit hour offsets. This was a real input-validation gap.
2. **Minimal fix:** `src/domain/booking.js` now limits explicit ISO offsets to `Z`, hours 00–13 with valid minutes, or 14:00 (positive/negative). The malformed-offset test was rerun: 9/9 PASS.
3. Two-process tests: both independent-key conflict and same-key replay PASS.
4. Final full regression: **41/41 PASS**, no skips. This history must not be rewritten into a claim that the initial run passed.

## Recommended next sequence

1. Complete T10: comprehensive malformed/missing customer, vehicle, service/dealer, timestamp and payload matrix. Test ownership invariants and no-partial-writes.
2. Complete T19: explicit DST gap/fold cases using an IANA DST dealership zone, and confirm whether product policy is reject or normalize; test product behavior, not just Luxon parsing.
3. Complete T17: isolated end-to-end server process restart and HTTP GET after reopening on the same temporary SQLite path.
4. Complete T20–T21: stale-slot UI failure flow, keyboard/accessibility and error/redaction evidence.
5. Review other documented M5 risks: lock contention/SQLITE_BUSY, repeat cancellation semantics, cancellation/rebooking across processes; distinguish Keyloop minimum from self-imposed robustness criteria.
6. Re-run full automated suite + browser tests, package sanitized evidence and notebook, then proceed to submission.

**Safety:** No destructive seed/reset on live SQLite. No token/PAT copied to evidence. Do not mark T10/T17/T19/T20/T21 fully PASS until missing scenarios are exercised.

## Follow-up Acceptance Verification — 2026-10-10 ICT

Run on Kaggle device `bd5d6d0e-c31f-4843-8330-9a5fed92a520`. All added tests use temporary SQLite databases. Live SQLite was backed up with the SQLite online backup API before these changes and contained 44 appointments with integrity `ok`.

| Group | Current status | Evidence |
|---|---|---|
| T10 invalid references/input | PASS for executed negative matrix | `tests/validation-dst.test.js`: missing/typed fields, invalid customer/vehicle/dealer/service, mismatched owner, bad time, past/closed time, malformed JSON; zero rows persisted |
| T17 actual server restart | PASS | `tests/server-restart.test.js`: independent Hono child process, POST booking, SIGTERM, restart on same temporary DB, GET confirmed |
| T19 DST | PARTIAL | `tests/validation-dst.test.js` confirms Luxon gap normalization and fold offset distinction, **but does not verify application booking rejection/acceptance around DST transitions**. No claim of full policy coverage |
| T20 reviewer accessibility | PARTIAL | Existing browser tests cover UI rendering and interaction. Windows Narrator, actual phone touch, keyboard/focus audit and stale-slot forced-conflict still require independent verification |
| T21 request logging/security | PARTIAL | `tests/observability-security.test.js`: request ID header/error correlation, secret canary absent from structured log and JSON error. Detailed metrics/latency histograms and exhaustive log redaction remain unverified |

The new validation/DST test's name concerning no double-booking reflects two distinct UTC instants; it is **not a booking-engine DST acceptance test**. Production dealer seed uses `Asia/Ho_Chi_Minh` (no DST). Explicit UTC instants should not be confused with wall-clock-only booking requests.

The suite includes earlier 41/41 PASS tests. Follow-up full regression: 45/45 PASS (0 failed, 0 skipped); browser checks must be reported separately with their observed exit codes. This note does not replace the historical 8 PASS / 1 FAIL malformed `+99:00` finding before the input-validation fix.

**Remaining priorities:** T19 booking behavior in a DST IANA zone; T20 stale-slot E2E/manual Narrator/Android/keyboard/contrast; T21 richer observability tests and request-body limits where required by the implementation plan. Do not mark the 21-case audit fully closed based on the 45/45 automated suite alone.

## DST booking engine and stale-slot browser evidence — 2026-10-10 ICT

- **T19 booking DST: PASS for executed engine cases.** Added `tests/dst-booking.test.js`: service intervals spanning spring-forward or fall-back offset transitions are rejected with `DST_TRANSITION` and create no rows; the explicit second fall-fold instant can be booked independently when it fits a shift; different encodings of the same UTC instant cannot create overlapping bookings. The initial run had **2 FAIL / 2 PASS**, proving the missing transition guard; after changing `src/domain/booking.js` the focused run achieved **4/4 PASS**. This is an explicit conservative design choice: reject DST-crossing intervals instead of guessing wall-clock semantics. It does not prove every worldwide timezone/DST edge case.
- **T20 stale-slot browser: PASS for automated scenario.** Added `scripts/stale-slot-browser-test.js`. With an isolated SQLite/Hono server the UI selects 09:00, a second user books that slot, the original client receives HTTP 409 and shows a friendly conflict message, refreshes availability, removes 09:00 and leaves only the winner row. No live database writes. Manual accessibility (Windows Narrator, actual Android Chrome, keyboard/contrast) remains **NOT VERIFIED** in this round.
- **Full automated regression: 49/49 PASS**, no skipped tests. The sandbox browser stale-slot test separately reports `STALE_SLOT_BROWSER=PASS`.
- **T21 observability/security** remains PARTIAL for richer metrics, request-body caps and exhaustive redaction assertions; previous request-ID/token canary tests remain PASS.

Historical failures remain visible above. No claim of complete T20 accessibility or T21 operational-hardening acceptance.

## T21 request protection and SQLite lock contention — 2026-10-10 ICT

- The POST booking and simulation JSON parsers now enforce **16 KiB** in `src/app.js`, both at declared `Content-Length` preflight and while streaming chunks. Oversized payloads receive HTTP **413** / `PAYLOAD_TOO_LARGE` without a booking. Malformed payloads still return 400. The UI's normal small booking payloads are unaffected.
- Real SQLite lock contention is exercised on a **temporary on-disk SQLite file**: a second connection holds `BEGIN IMMEDIATE`, the booking API responds HTTP **503** / `DATABASE_BUSY`, and no appointment row is partially saved. It does not imply bounded retry logic or throughput targets have been implemented.
- `tests/body-limit-and-contention.test.js`: **2/2 PASS**, including chunked-body limit and busy lock.
- Existing `tests/observability-security.test.js`: correlation between `X-Request-ID` and JSON error request ID, no demo token canary in response/structured log. This is a targeted redaction test, not a comprehensive secret-leak audit.
- **Full isolated `npm test` regression: 51/51 PASS, 0 failed, 0 skipped**.
- Operational hardening **PARTIAL**: structured request ID, method/path/status/latency fields exist, but production-grade historical metrics (route p50/p95, aggregate counters), controlled busy retries, comprehensive redaction testing and manual screen reader/Android QA are not finished.

## Manual two-tab stale-slot verification — 2026-10-10 ICT

- Evidence submitted by the reviewer: `kjlsobnmvx7osfvgfl.549.log` (successful booking confirmation) and `kjlsobnmvx7osfvgfl.548.log` (stale-tab rejection view). The source files are reviewer-provided HTML captures, not browser-network HAR exports.
- Confirmed booking: Air Conditioning, Central Auto Service, 2026-10-12 13:00–14:30 Asia/Ho_Chi_Minh, Quinn / Climate & Alignment; appointment `apt_ce594d32-c54f-41ab-acfc-9598c9fb8dbf`.
- Application log: one `POST /api/v1/appointments` HTTP **201**, followed by one competing `POST /api/v1/appointments` HTTP **409**, then availability refresh. The stale tab displayed a conflict notice, removed the selected slot from availability and disabled confirmation until another time was chosen.
- Reviewer explicitly clicked **Refresh** to update the appointment counter. Refresh is read-only. Live state observed: **45 total = 33 confirmed + 12 cancelled**, compared with 44 total before the manual test. SQLite `PRAGMA integrity_check` was `ok`.
- **Verdict: MANUAL STALE-SLOT FLOW PASS** for observed UI, HTTP sequence and persisted record count. Do not infer a full browser-network trace or global resource-overlap proof from these two HTML captures alone.
- Follow-up UX: conflict notice now states clearly that **the rejected request created no appointment**, asks the reviewer to select another available time, and only applies to the `SLOT_UNAVAILABLE` application error. The existing isolated Playwright stale-slot assertion has been aligned with that copy; browser rerun requires working Chromium OS libraries on Kaggle.
- This verification does not close unrelated manual accessibility coverage (Narrator/Android/keyboard/contrast).
