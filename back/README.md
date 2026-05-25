# PatchProof Back

Laravel API for hosted PatchProof data.

## Purpose

This backend stores projects and scan reports produced by the local CLI or the GitHub Action.

It is intentionally small at first:

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project}`
- `GET /api/projects/{project}/summary`
- `GET /api/projects/{project}/scans`
- `GET /api/projects/{project}/api-keys`
- `POST /api/projects/{project}/api-keys`
- `DELETE /api/projects/{project}/api-keys/{apiKey}`
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

To create project API keys in development, set `PATCHPROOF_ADMIN_KEY` in `.env`
and send it as `X-PatchProof-Admin-Key` to `POST /api/projects/{project}/api-keys`.
To upload scans, send the issued key in `Authorization: Bearer <token>` or
`X-PatchProof-Key: <token>`.

`GET /api/scans` and `GET /api/projects/{project}/scans` accept filters such as
`status`, `language`, `source`, `from`, `to`, and `per_page`.

`GET /api/projects/{project}/summary` returns totals, status breakdowns,
language/source breakdowns, severity rollups, the latest scan timestamp, and
the five most recent scans for the dashboard.

## Data model

- `projects` stores a team or repository scope.
- `scans` stores normalized findings and metadata.
- `project_api_keys` stores hashed upload tokens for a project.
- The API avoids storing raw source code by default.

## Defaults

- English is the default report language.
- Spanish is supported when the CLI sends `language=es` or `--lang es`.
- SQLite is convenient for local demos and tests.
- MySQL is the recommended production database for hosted PatchProof.
