# Reviewer Test Guide — Keyloop Scenario A

**Unified Service Scheduler** | Node.js + Hono + SQLite3; Vue 3 + Tailwind CSS CDN, no frontend build tool.

## Access and prerequisites

Open the **public demo link** supplied by the project author (a Cloudflare Quick Tunnel URL can change after restart). The project serves the browser and REST API through the same origin. Use a recent desktop browser; the interface also supports narrow mobile screens. **No account required for read-only exploration.** The page first displays a **Read-only preview — Booking access required** explanation, followed by a **Demo write token** field and **Verify token** button: only the author can provide an authorized token if you are expected to perform Create/Cancel. Never copy the token into public reports, screenshots, or GitHub issues.

For local execution on an authorized checkout:
```bash
npm ci
npm run db:migrate
npm run db:seed:rich
npm run db:seed:demo
npm test
npm start
```
Visit `http://127.0.0.1:3000`. These seeds use **INSERT OR IGNORE** and fixed idempotency keys for each date, so reruns do not erase existing data or multiply identical appointments.

## Suggested 7–10 minute guided walkthrough

| Step | Test action | Expected result | Requirement |
|---|---|---|---|
| 1 | Open home page, inspect dealership, customer, vehicle, service and appointment list | The page renders; dropdowns have many synthetic records | A-1 |
| 2 | Choose **North Service Hub** and a future weekday, then **Oil Change** | Times appear only when both a qualified technician and a compatible bay have capacity for the full duration | A-2 |
| 3 | Change service to **Brake Inspection (90 min)** | Availability recalculates; different eligibility/capacity may apply | A-2 |
| 4 | Change **Customer** | Only their vehicle(s) appear in the Vehicle dropdown | A-1 |
| 5 | Observe the **Appointments** section before doing anything | A mix of pre-seeded confirmed and cancelled appointments exists across dealerships | A-3 |
| 6 | With authorized token, choose a valid slot and press **Confirm appointment** | Confirmation shows appointment ID and allocated technician/bay; row persists after refresh | A-1, A-2, A-3 |
| 7 | Revisit same start time with the same constrained brake resources | A double booking is prevented; the slot disappears when all qualified resources are occupied | A-2 |
| 8 | With token, press **Cancel** on your appointment | Status becomes cancelled; capacity can be reused; the audit record remains | A-3 |
| 9 | Run `npm run test:concurrency` | 10 independent workers start together; exactly **1** confirmed, **9** rejected; DB contains no overlap | A-2 |
| 10 | Run `npm test` and `npm run evidence` | Automated tests pass; DB integrity and no-overlap checks pass | Verification |

**Demo restrictions:** Test appointments are synthetic, but writes change the shared SQLite demo file. Prefer creating one or two bookings and cancelling only records you created. The site does **not** offer a reset button. Avoid editing or deleting existing reviewer evidence.

## Useful ready-made data combinations

- **Central Auto Service** (`dlr_001`): baseline Oil Change (45 min), Brake Inspection (90 min), Diagnostics (60 min); additional Tire Rotation and Battery services.
- **West Auto Service** (`dlr_002`): Oil Change plus Powertrain and Detailing resources.
- **North Service Hub** (`dlr_003`) and **East Motor Center** (`dlr_004`): multiple technicians/bays to explore overlapping schedules.
- **South Auto Care** (`dlr_005`) and **Airport Automotive** (`dlr_006`): additional weekday capacity and populated appointment examples.
- **Demo Customer A** and **Demo Customer B** are preserved for backwards compatibility, along with 18 new synthetic customers and cars.

Use a date **Monday–Saturday, 08:00–18:00**, and note the technician lunch shift break **12:00–13:00**. Service duration must fit fully before closing or break. All displayed dates/times are in `Asia/Ho_Chi_Minh`; the API persists absolute UTC instants. The exact available slots depend on existing confirmed appointments.

## REST API examples

```bash
BASE=http://127.0.0.1:3000
curl -s "$BASE/readyz"
curl -s "$BASE/api/v1/dealerships"
curl -s "$BASE/api/v1/customers"
curl -s "$BASE/api/v1/customers/cus_003/vehicles"
curl -s "$BASE/api/v1/dealerships/dlr_003/service-types"
curl -s "$BASE/api/v1/appointments"
# Replace YYYY-MM-DD with a valid upcoming weekday
curl -s "$BASE/api/v1/availability?dealershipId=dlr_003&serviceTypeId=svc_oil&date=YYYY-MM-DD"
```

Create requests require `Idempotency-Key`, a JSON payload with `customerId`, `vehicleId`, `dealershipId`, `serviceTypeId`, `startAt`, and — on the protected public demo — the private `X-Demo-Write-Token`. Request time includes an explicit UTC offset or `Z`.

## Expected error cases

- Invalid/missing Idempotency-Key → 400.
- Customer is not the owner of vehicle → 422.
- Request outside opening hours / past date → 422.
- Attempt to reserve when no compatible technician+bay is free → 409.
- Retry identical payload with identical Idempotency-Key → 200, same appointment ID, no duplicate row.
- Reuse a key with a changed payload → 409.
- Missing or wrong write token on public demo → 403.
- Successful new appointment → 201, persisted to SQLite; GET returns 200.

## Automated evidence and limitations

Review `npm test`, `npm run test:concurrency`, `npm run test:browser`, `npm run test:browser:e2e`, `notebooks/Scenario_A_Reviewer_Demo.ipynb` and the runtime files under `evidence/`. Concurrency test uses isolated temporary SQLite data and will **not** change demo bookings. Browser E2E and HTTP smoke tests **do** create/cancel synthetic bookings in the configured environment. The public demo is accessible only while the temporary tunnel and Kaggle runtime stay online.

Manual screen-reader and physical-phone checks must be recorded as separate human verification, not inferred from Playwright results.

## If booking says a demo token is required

This is **not** a scheduling failure: the temporary public demo protects writes to its shared SQLite database. You can continue exploring dealerships, availability and existing bookings without any credential. To test booking or cancellation, contact the project owner through your existing review channel for a private demo write token, enter it on the home page and click **Verify token**. If verification rejects the token, check for accidental whitespace or ask for a new token. Never post tokens to public comments or issue trackers. When no token has been entered, Confirm and Cancel controls are disabled so users do not unexpectedly encounter a 403.
