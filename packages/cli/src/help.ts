export function helpText(): string {
  return [
    'PatchProof - local-first security review for AI-generated diffs',
    '',
    'Start here:',
    '  1. patchproof paudit --diff',
    '  2. patchproof paudit --file changes.diff',
    '  3. git diff | patchproof paudit',
    '  4. ppscan /path/to/repo --format markdown',
    '',
    'What it does:',
    '  - paudit --diff    audits the current repo diff',
    '  - paudit --file    audits a saved diff file',
    '  - git diff | paudit audits piped diff text',
    '  - ppscan           scans a repo working tree',
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
    '  --format <format>      text, json, markdown, or sarif',
    '  --fail-on <severity>   critical, high, medium, or low. Default: high',
    '  --lang <lang>          en or es. Default: en'
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
