# PatchProof Audit Report — 2026-05-29

## Context

This report captures the current state of PatchProof after the OWASP coverage expansion and the latest scan against:

- Repository: `/Users/juanurquiza/Documents/dev/totsDev/Kupyo/api-php-tots`
- PatchProof version: `0.3.0`

## Summary

The latest `ppscan` run found **28 findings** across **712 files**.

### Findings by rule

| Rule | Count | Meaning |
|---|---:|---|
| PP002 | 4 | Potential SQL injection |
| PP006 | 8 | Sensitive public routes without obvious auth |
| PP007 | 3 | Object-level authorization bypass risks |
| PP013 | 3 | Auth endpoints without throttle protection |
| PP014 | 1 | Weak or empty password values |
| PP015 | 2 | OTP/code validation routes without throttle |
| PP016 | 1 | Password change without confirmation protection |
| PP017 | 2 | OTP/code issuance routes without throttle |
| PP022 | 1 | Dangerous business action without safety step |
| PP023 | 4 | Swallowed exception without logging |

## What this means

- The scanner is now covering the main OWASP categories we targeted:
  - A01, A02, A03, A04, A05, A06, A07, A08, A09, A10
- The remaining findings are concentrated in:
  - public routes and object-level auth gaps
  - a handful of SQL raw query patterns
  - one intentional password placeholder in app code
  - swallowed exceptions

## Notable observations

- The A01 heuristics were tightened so that obvious public-by-design routes no longer inflate the report.
- The A09 rule is intentionally narrow: it only flags swallowed PHP exceptions without logging.
- The A04 rule now ignores maintenance-style `sync` actions and only targets clearly high-impact business actions.

## Recommended next steps

1. Review the remaining 28 findings and decide which are intentional design trade-offs.
2. Tighten A01 further if the remaining route findings are confirmed false positives.
3. Begin the hosted backend/frontend work for report ingestion, storage, and dashboarding.

## Status

- PatchProof CLI version: `0.3.0`
- Tests: passing
- Build: passing
- Latest scan: 28 findings
