# PatchProof

PatchProof is a local-first security review tool for AI-generated code diffs.

Spanish README: [README_ES.md](README_ES.md).

The first release focuses on a fast npm CLI that audits `git diff` output before code reaches a pull request. The hosted Laravel + Angular product is already in progress: the Laravel backend stores projects, scans, and project API keys for hosted ingestion, and the Angular front-end now shows project summaries, scan history, and key management.

## Project Layout

```txt
patchproof/
  packages/core/  TypeScript audit engine and built-in rules
  packages/cli/   `npx patchproof` CLI
  back/           Laravel API for hosted reports, teams, and API keys
  front/          Angular dashboard for scan history and reports
```

## Quick Start

```bash
npm install
npm run build
git diff | node packages/cli/dist/index.js paudit
node packages/cli/dist/index.js paudit --diff --format sarif
node packages/cli/dist/index.js ppscan /path/to/repo --format markdown
```

If you want the hosted dashboard, run the Laravel backend first and then the Angular front. In development, the front points at `http://127.0.0.1:8001/api` through `src/environments/environment.development.ts`.

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

## Privacy Defaults

PatchProof runs locally by default. The CLI does not send code to a server or an LLM. Future hosted features should upload normalized findings and metadata by default, not raw source code.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

## Roadmap

1. Expand rules with AST-aware checks for TypeScript, PHP/Laravel, Angular, and Node.js.
2. Add custom rules and config loading from `patchproof.config.json`.
3. Ship the GitHub Action wrapper with SARIF upload support.
4. Improve `ppscan` working tree scanning and path filtering.
5. Implement `back/` Laravel hosted reporting.
6. Add project API key management and authenticated scan ingestion.
7. Implement `front/` Angular dashboard.
