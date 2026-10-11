# Contributing

Thanks for helping improve the Unified Service Scheduler.

## Getting started

Use Node.js 24+, run `npm ci`, `npm test`, and read [README](README.md) and [system design](docs/SYSTEM-DESIGN.md). Changes should preserve transactional qualification, full-duration resource availability, idempotency, and overlap constraints.

## Pull requests

Describe the problem, rationale, changed behavior, and a reproducible test using only synthetic records. Run the tests before opening a pull request. Do not commit SQLite runtime databases, API keys, write tokens, or private logs.

For changes to the scheduling algorithm, include competing-request cases and demonstrate that no technician or bay is double-booked. For notebook changes, validate its JSON and run all executable cells.

## Security reports

Use [SECURITY.md](.github/SECURITY.md) instead of public issues for vulnerabilities.
