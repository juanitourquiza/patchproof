# PatchProof Back

Laravel API placeholder for the hosted PatchProof product.

Do not build this before the CLI has real usage. The backend should start when there is a need for hosted scan history, teams, API keys, billing, or private rule policies.

## Planned Responsibilities

- API key authentication for CLI uploads.
- Projects, scans, findings, and rule policy storage.
- Team and organization boundaries.
- Billing-ready plan checks.
- Privacy-first storage: findings by default, raw code only with explicit opt-in.

## Initial API Shape

```http
POST /api/scans
GET  /api/scans/{id}
GET  /api/projects/{id}/scans
GET  /api/projects/{id}/findings
```

Responses should use the same finding contract produced by `@patchproof/core`.
