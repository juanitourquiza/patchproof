# PatchProof

PatchProof is a local-first security review tool for AI-generated code diffs.

Spanish README: [README_ES.md](README_ES.md).

Latest release: `v0.3.0`

Latest reference audit baseline: `0 findings` across the PHP sample repo used in this workspace.

The first release focuses on a fast npm CLI that audits `git diff` output before code reaches a pull request. The product direction is now local-first: the Laravel backend stores projects and scans from each developer's machine, and the Angular front-end shows project summaries, scan history, and project creation without requiring API keys.

Current OWASP coverage is intentionally incremental, not exhaustive. PatchProof currently covers focused checks for:

- A01 Broken Access Control
- A03 Injection
- A05 Security Misconfiguration
- A06 Vulnerable and Outdated Components
- A07 Identification and Authentication Failures
- A10 Server-Side Request Forgery
- A02 Cryptographic Failures
- A08 Software and Data Integrity Failures
- A04 Insecure Design
- A09 Security Logging and Monitoring Failures

PatchProof also ships deterministic remediation guidance for each finding, plus optional AI enrichment when you want more context or alternative fixes.

## Project Layout

```txt
patchproof/
  packages/core/  TypeScript audit engine and built-in rules
  packages/cli/   `npx patchproof` CLI
  back/           Laravel API for local scan storage and dashboard data
  front/          Angular dashboard for scan history and reports
```

## Quick Start

```bash
npm install
npm run build
git diff | node packages/cli/dist/index.js paudit
node packages/cli/dist/index.js paudit --diff --format sarif
node packages/cli/dist/index.js ppscan /path/to/repo --format markdown
node packages/cli/dist/index.js report /path/to/repo --report patchproof-report.md
```

If you want the dashboard, run the Laravel backend first and then the Angular front. In development, the front points at `http://127.0.0.1:8001/api` through `src/environments/environment.development.ts`.

After publishing, the intended public command is:

```bash
npx patchproof paudit --diff
```

## CLI Commands

```bash
patchproof paudit --diff
patchproof paudit --file changes.diff --format json
git diff | patchproof paudit --format markdown
patchproof ppscan /path/to/repo --include-ignored --format markdown
patchproof report /path/to/repo --report patchproof-report.md
patchproof rules
patchproof init
```

## Config

`patchproof.config.json` can live in the current directory or any parent directory. Use it to set `failOn` and to enable or disable built-in rules.
It also supports `language: "en"` or `language: "es"` for report output. English is the default.

## GitHub Action

Use the action from this repository once the package is available on npm, or in `local` mode from a checked-out copy.

```yaml
- uses: juanitourquiza/patchproof@main
  with:
    mode: npm
    format: sarif
    lang: en
    fail-on: high
```

## AST Rules

AST rules parse the code syntax instead of only matching text. That lets PatchProof understand calls like `db["query"](...)` or `globalThis["eval"](...)`, which a plain regex can miss or misread. In practice, AST rules mean fewer false negatives and less noise.

## Built-In Rules

| Rule | Purpose |
|---|---|
| `PP001` | Hardcoded secrets and credential-like values |
| `PP002` | Potential SQL injection through interpolated queries |
| `PP003` | Unsafe HTML rendering and XSS sinks |
| `PP004` | Dangerous dynamic execution or command execution |
| `PP005` | Wildcard CORS origins |
| `PP006` | Sensitive public routes without obvious auth |
| `PP007` | Object-level authorization bypass risks |
| `PP008` | Debug or non-production config exposure |
| `PP009` | Permissive security headers |
| `PP010` | Insecure session cookie settings |
| `PP011` | Insecure proxy / HTTPS configuration |
| `PP012` | Verbose logging or error exposure |
| `PP013` | Auth endpoints without throttle protection |
| `PP014` | Weak or empty password values |
| `PP015` | OTP/code validation routes without throttle |
| `PP016` | Password change without confirmation protection |
| `PP017` | OTP/code issuance routes without throttle |
| `PP018` | Potential SSRF via outbound requests |
| `PP019` | Potential vulnerable dependency versions |
| `PP020` | Weak cryptographic hash usage |
| `PP021` | Unsafe PHP deserialization |
| `PP022` | Dangerous business action without safety step |
| `PP023` | Swallowed exception without logging |

## Privacy Defaults

PatchProof runs locally by default. The CLI does not send code to a server or an LLM. Future hosted features should upload normalized findings and metadata by default, not raw source code.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Roadmap

1. Expand A02, A04, A08, and A09 with more crypto/design/integrity/logging checks.
2. Keep the reference audit baseline clean as new features land.
3. Add custom rules and config loading from `patchproof.config.json`.
4. Ship the GitHub Action wrapper with SARIF upload support.
5. Improve `ppscan` working tree scanning and path filtering.
6. Continue improving `back/` Laravel local scan storage and summaries.
7. Keep the local dashboard focused on projects and scan history.
8. Simplify local scan ingestion and reporting.
