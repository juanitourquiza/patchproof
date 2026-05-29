# PatchProof Usage Log

PatchProof now records tool usage in the hosted backend when scans are submitted.

## What gets stored

- Project ID
- Scan ID
- Usage kind
- Source (`cli`, `github-action`, etc.)
- Language
- `fail_on`
- Output format
- Scan status
- Findings total
- Metadata payload

## Where it lives

- Database table: `usage_events`
- API:
  - `GET /api/usage-events`
  - `POST /api/projects/{project}/usage-events`

## How the front shows it

- The project summary now includes a "Tool usage log" panel with the latest usage events for the selected project.

## Why this exists

- To keep an auditable history of PatchProof usage when the hosted back/front are running.
- To complement scan history with a clearer operational log of tool activity.
