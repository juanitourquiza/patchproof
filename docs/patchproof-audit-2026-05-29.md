# PatchProof Audit Report — 2026-05-29

## Context

This report captures the current state of PatchProof after the OWASP coverage expansion and the latest scan against:

- Repository: `/Users/juanurquiza/Documents/dev/totsDev/Kupyo/api-php-tots`
- PatchProof version: `0.3.0`

## Summary

The latest `ppscan` run found **0 findings** across **712 files**.

### Findings by rule

No findings were reported in the current baseline scan.

## What this means

- The scanner is now covering the main OWASP categories we targeted:
  - A01, A02, A03, A04, A05, A06, A07, A08, A09, A10
- The current baseline scan is clean.

## Notable observations

- The A01 and A04 heuristics were tightened so that the reference repo now scans cleanly.
- The latest allowlist and safety-step updates removed the last route and business-action noise from the report.

## Recommended next steps

1. Keep the clean baseline stable as new changes are introduced.
2. Continue the hosted backend/frontend work for report ingestion, storage, and dashboarding.
3. Add more fixtures whenever new rule families are introduced.

## Status

- PatchProof CLI version: `0.3.0`
- Tests: passing
- Build: passing
- Latest scan: 0 findings
