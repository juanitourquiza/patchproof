# PatchProof Front

Angular dashboard for hosted PatchProof scans, project summaries, and API keys.

## What it shows

- Project list with scan counts.
- Project summary with severity, language, and source rollups.
- Recent scan cards with project name, findings, and severity summary.
- Remediation guidance per finding, derived from the hosted scan payload.
- Project API keys with revocation controls.
- Local admin key storage in the browser to unlock API key management.
- Optional local AI API key storage to generate enriched remediation guidance.

## Local development

```bash
cd front
npm install
npm start
```

The front runs on `http://localhost:4202` by default.
In development it uses `src/environments/environment.development.ts`, which points to `http://127.0.0.1:8001/api`.

If your backend runs on another port, edit `src/environments/environment.development.ts`
and update `back/config/cors.php` or `CORS_ALLOWED_ORIGINS` in `back/.env`.

Start the Laravel backend first, then run the front.

## Notes

- English is the default UI language.
- The front consumes the Laravel JSON contract directly.
- This is an operational dashboard, not a landing page.
