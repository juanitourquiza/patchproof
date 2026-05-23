# Architecture

PatchProof is split into a local open source scanner and an optional hosted product.

## Local Scanner

`packages/core` owns the audit contract:

- Parse unified diffs.
- Run built-in and future custom rules.
- Return stable `Finding` objects.
- Stay framework-agnostic and side-effect free.

`packages/cli` owns developer workflow:

- Read diff input from git, files, or stdin.
- Print text, JSON, Markdown, and SARIF reports.
- Return predictable CI exit codes.

## Hosted Product

`back/` will be a Laravel API for:

- Organizations, users, projects, and API keys.
- Scan history and finding trends.
- Rule policy packs and team thresholds.
- Billing-ready plan boundaries.

`front/` will be an Angular dashboard for:

- Project scan history.
- Severity trends.
- Finding details and remediation guidance.
- Rule coverage and policy settings.

## Contracts

The shared finding contract is intentionally small:

```ts
interface Finding {
  id: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file: string;
  line: number;
  evidence: string;
  recommendation: string;
  tags: string[];
}
```

Avoid changing existing fields after public release. Add optional fields instead.
