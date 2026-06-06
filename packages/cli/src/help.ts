export function helpText(): string {
  return [
    'PatchProof - local-first security review for AI-generated diffs',
    '',
    'Start here:',
    '  1. patchproof paudit --diff',
    '  2. patchproof paudit --file changes.diff',
    '  3. git diff | patchproof paudit',
    '  4. patchproof scan /path/to/repo',
    '  5. ppscan /path/to/repo --format markdown',
    '  6. patchproof report /path/to/repo --report patchproof-report.md',
    '',
    'What it does:',
    '  - paudit --diff    audits the current repo diff',
    '  - paudit --file    audits a saved diff file',
    '  - git diff | paudit audits piped diff text',
    '  - ppscan           scans a repo working tree',
    '  - scan             interactive repo scan with save/report choices',
    '  - report           scans a repo and writes a report file',
    '',
    'Other commands:',
    '  patchproof rules   list built-in rules',
    '  patchproof init    create patchproof.config.json',
    '',
    'Config:',
    '  patchproof.config.json in the current directory or any parent directory',
    '',
    'Options:',
    '  --diff                 Read from git diff --unified=3',
    '  --file <path>          Read a unified diff from a file',
    '  --include-ignored      ppscan: include ignored files like dist/',
    '  --api-base-url <url>   scan: backend API base URL when saving',
    '  --project-name <name>  scan: project name to save or reuse',
    '  --project-slug <slug>  scan: project slug to save or reuse',
    '  --save                 scan: save directly without prompting',
    '  --no-save              scan: force local-only scan without prompting',
    '  --format <format>      text, json, markdown, or sarif',
    '  --report <path>        Write the formatted report to a file',
    '  --fail-on <severity>   critical, high, medium, or low. Default: high',
    '  --lang <lang>          en or es. Default: en',
    '',
    'Scan rules:',
    '  - ppscan always skips AI-assistant folders like .claude/,.cursor/,.windsurf/, and .copilot/.',
    '  - The scanner is intended to report on code, not agent instructions or prompt files.'
  ].join('\n');
}

export function initConfigText(): string {
  return JSON.stringify(
    {
      schema: 'https://patchproof.dev/config.schema.json',
      failOn: 'high',
      language: 'en',
      privacy: {
        sendCodeToCloud: false,
        llmExplanations: false
      },
      rules: {
        enabled: ['PP001', 'PP002', 'PP003', 'PP004', 'PP005']
      }
    },
    null,
    2
  );
}
