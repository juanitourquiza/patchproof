export function helpText(): string {
  return [
    'PatchProof - local-first security review for AI-generated diffs',
    '',
    'Usage:',
    '  patchproof audit --diff',
    '  patchproof audit --file changes.diff --format json',
    '  git diff | patchproof audit --format markdown',
    '  patchproof rules',
    '  patchproof init',
    '',
    'Options:',
    '  --diff                 Read from git diff --unified=3',
    '  --file <path>          Read a unified diff from a file',
    '  --format <format>      text, json, markdown, or sarif',
    '  --fail-on <severity>   critical, high, medium, or low. Default: high'
  ].join('\n');
}

export function initConfigText(): string {
  return JSON.stringify(
    {
      schema: 'https://patchproof.dev/config.schema.json',
      failOn: 'high',
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
