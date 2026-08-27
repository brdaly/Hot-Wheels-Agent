# Security policy

Report vulnerabilities privately to the repository owner. Do not open public issues containing credentials, customer photos, collection records, exploit details, or personal data.

## Controls

- Secrets are server-only environment variables.
- Image uploads are count-, size-, MIME- and magic-byte validated.
- Analysis calls use `store: false`; raw photos are not persisted by default.
- Collection endpoints require a constant-time bearer-token check.
- Database tables use row-level security with no public policies.
- Security headers, request traces, bounded structured output and deterministic policy reduce injection and data-flow risk.

Before public launch, replace the in-memory rate limiter with a distributed provider, rotate deployment secrets, enable platform WAF/budget alerts, review data retention, add authenticated user accounts, and commission an independent security review.
