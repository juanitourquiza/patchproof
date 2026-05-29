# PatchProof Audit Report — 2026-05-29

## Context

This report captures the current state of PatchProof after the OWASP coverage expansion and the latest scan against:

- Repository: `/Users/juanurquiza/Documents/dev/totsDev/Kupyo/api-php-tots`
- PatchProof version: `0.2.0`

## Summary

The latest `ppscan` run found **36 findings** across **712 files**.

### Findings by rule

| Rule | Count | Meaning |
|---|---:|---|
| PP002 | 6 | Potential SQL injection |
| PP006 | 8 | Sensitive public routes without obvious auth |
| PP007 | 3 | Object-level authorization bypass risks |
| PP013 | 3 | Auth endpoints without throttle protection |
| PP014 | 5 | Weak or empty password values |
| PP015 | 2 | OTP/code validation routes without throttle |
| PP016 | 1 | Password change without confirmation protection |
| PP017 | 2 | OTP/code issuance routes without throttle |
| PP022 | 2 | Dangerous business action without safety step |
| PP023 | 4 | Swallowed exception without logging |

## What this means

- The scanner is now covering the main OWASP categories we targeted:
  - A01, A02, A03, A04, A05, A06, A07, A08, A09, A10
- The remaining findings are concentrated in:
  - public routes and cron endpoints
  - SQL raw queries
  - weak password handling
  - swallowed exceptions

## Notable observations

- The A01 heuristics were tightened so that obvious public-by-design routes no longer inflate the report.
- The A09 rule is intentionally narrow: it only flags swallowed PHP exceptions without logging.
- The A04 rule is conservative and only targets high-impact business actions in controller and route files.

## Recommended next steps

1. Review the remaining 36 findings and decide which are intentional design trade-offs.
2. Tighten A01 further only if the remaining route findings are confirmed false positives.
3. Expand coverage only where the current signal is strong and stable.

## Status

- PatchProof CLI version: `0.2.0`
- Tests: passing
- Build: passing
- Latest scan: 36 findings
