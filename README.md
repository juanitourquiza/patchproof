# PatchProof

PatchProof is a local-first security review tool for AI-generated code diffs.

Spanish README: [README_ES.md](README_ES.md).

The first release focuses on a fast npm CLI that audits `git diff` output before code reaches a pull request. The hosted Laravel + Angular product comes after the CLI proves value in real developer workflows.

## Project Layout

```txt
patchproof/
  packages/core/  TypeScript audit engine and built-in rules
  packages/cli/   `npx patchproof` CLI
  back/           Laravel API plan for hosted reports, teams, API keys, billing
  front/          Angular dashboard plan for scan history and reports
```

## Quick Start

```bash
npm install
npm run build
git diff | node packages/cli/dist/index.js audit
node packages/cli/dist/index.js audit --diff --format sarif
```

After publishing, the intended public command is:

```bash
npx patchproof audit --diff
```

## CLI Commands

```bash
patchproof audit --diff
patchproof audit --file changes.diff --format json
git diff | patchproof audit --format markdown
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
4. Implement `back/` Laravel hosted reporting.
5. Implement `front/` Angular dashboard.
