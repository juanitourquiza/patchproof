# PatchProof Back

Laravel API for local PatchProof scan data and dashboard summaries.

## Purpose

This backend stores projects and scan reports produced by the local CLI.
It also derives remediation guidance for each finding so the dashboard can show fix options
without needing AI.

It is intentionally small at first:

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project}`
- `GET /api/projects/{project}/summary`
- `GET /api/projects/{project}/scans`
- `GET /api/scans`
- `GET /api/scans/{scan}`
- `POST /api/scans`

## Local setup

```bash
cd back
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

If port `8000` is already in use, Laravel will usually fall back to `8001`.
If you change the front port or backend port, update `CORS_ALLOWED_ORIGINS`
in `back/.env` so the browser can reach the API.

`GET /api/scans` and `GET /api/projects/{project}/scans` accept filters such as
`status`, `language`, `source`, `from`, `to`, and `per_page`.

`GET /api/projects/{project}/summary` returns totals, status breakdowns,
language/source breakdowns, severity rollups, the latest scan timestamp, and
the five most recent scans for the dashboard.

Each scan payload also includes `remediations`, a deterministic set of fix
options generated from the finding rule IDs. The contract is AI-ready:
`config/patchproof.php` exposes `remediation_ai` settings so a future release
can add optional provider-based enrichment without breaking the current API.

Optional AI enrichment is available through:

- `POST /api/scans/{scan}/remediations/ai`

The endpoint accepts an optional `api_key` in the request body or the
`X-PatchProof-AI-Key` header. If AI is disabled or no key is provided, it falls
back to deterministic remediation guidance so the dashboard stays useful.

## Data model

- `projects` stores a team or repository scope.
- `scans` stores normalized findings and metadata.
- The API avoids storing raw source code by default.

## Defaults

- English is the default report language.
- Spanish is supported when the CLI sends `language=es` or `--lang es`.
- SQLite is convenient for local demos and tests.
- MySQL is the recommended production database if you outgrow the local demo setup.
