# Security Policy

## Supported scope

This repository is a single-host reference implementation and reproducible scheduling lab, not a production multi-tenant service. The public demo write token is **not** production authentication.

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** mechanism, if available, rather than opening a public issue. If private reporting is not enabled, contact **i.am@dangkhoa.dev** with a minimal reproduction and avoid sharing secrets or personal data.

Do not disclose active access tokens, private customer records or unpatched exploit details in public issues. Maintainers will assess reports and coordinate a fix and disclosure.

## Deployment guidance

Bind to loopback for development. Do not expose unprotected write endpoints. Avoid sharing SQLite WAL files on a network filesystem, and use synthetic test data.
