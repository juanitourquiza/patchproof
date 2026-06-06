# PatchProof Front

Angular dashboard for local PatchProof scans, project summaries, and scan history.

## What it shows

- Project list with scan counts.
- Project summary with severity, language, and source rollups.
- Recent scan cards with project name, findings, and severity summary.
- Remediation guidance per finding, derived from the scan payload.
- Project cards with scan counts and latest scan timestamps.
- A project creation modal that keeps the dashboard uncluttered.
- Optional local AI provider configuration for enriched remediation guidance.
- A sidebar settings panel for configuring AI provider, model, base URL, and API key locally.

## Local development

```bash
cd front
npm install
npm start
```

The front runs on `http://localhost:4202` by default.
In development it uses `src/environments/environment.development.ts`, which points to `http://127.0.0.1:8001/api`.

To configure AI manually instead of using the UI, set these backend env vars in `back/.env`:

- `PATCHPROOF_REMEDIATION_AI_ENABLED=true`
- `PATCHPROOF_REMEDIATION_AI_PROVIDER=openai|anthropic|openai-compatible`
- `PATCHPROOF_REMEDIATION_AI_MODEL=...`
- `PATCHPROOF_REMEDIATION_AI_BASE_URL=...` for compatible/custom providers
- `PATCHPROOF_REMEDIATION_AI_API_KEY=...`

If your backend runs on another port, edit `src/environments/environment.development.ts`
and update `back/config/cors.php` or `CORS_ALLOWED_ORIGINS` in `back/.env`.

Start the Laravel backend first, then run the front.

## Notes

- English is the default UI language.
- The front consumes the Laravel JSON contract directly.
- This is an operational local dashboard, not a landing page.
