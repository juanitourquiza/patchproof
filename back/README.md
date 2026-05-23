# PatchProof Back

Laravel API for hosted PatchProof data.

## Purpose

This backend stores projects and scan reports produced by the local CLI or the GitHub Action.

It is intentionally small at first:

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project}`
- `GET /api/projects/{project}/scans`
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

## Data model

- `projects` stores a team or repository scope.
- `scans` stores normalized findings and metadata.
- The API avoids storing raw source code by default.

## Defaults

- English is the default report language.
- Spanish is supported when the CLI sends `language=es` or `--lang es`.
- SQLite is the default local database.
