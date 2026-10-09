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
