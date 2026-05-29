# ADR-002: Deterministic remediation suggestions with optional AI enrichment

## Status
Accepted

## Date
2026-05-29

## Context
PatchProof already detects risky diffs and stores hosted scan reports. The next product step is to help users fix findings, not just list them. The hosted dashboard needs a stable contract for showing remediation guidance per finding, with a path to optional AI-generated suggestions later.

## Decision
Expose deterministic remediation suggestions for every finding in the hosted scan API and render them in the dashboard. The initial implementation will map rule IDs to curated fixes, alternatives, and an AI-ready prompt. Optional AI enrichment can be added later behind explicit opt-in and provider configuration.

## Why this approach
- Keeps the product useful even when no AI key is configured.
- Avoids sending raw code by default.
- Lets PatchProof cache and reuse guidance by rule, language, and stack.
- Creates a stable interface for later AI integration without changing the base contract.

## Alternatives Considered

### AI-only remediation
- Pros: richer wording, more contextual suggestions
- Cons: requires a provider key, adds cost, and makes the UX dependent on an external model
- Rejected: users should get value even without AI

### Store remediations in the database only
- Pros: persistent and queryable
- Cons: adds complexity before the contract is proven; suggestions can be derived from the scan payload
- Rejected for now: start with computed suggestions, persist later if needed

## Consequences
- Hosted scan responses will include a `remediations` section per finding.
- The frontend can show fix options immediately.
- Future AI suggestions can reuse the same contract and add provider metadata without breaking consumers.
