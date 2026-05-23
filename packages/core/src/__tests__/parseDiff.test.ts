import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../parseDiff.js';

describe('parseUnifiedDiff', () => {
  it('extracts files and added lines from a unified diff', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,2 +1,3 @@',
      ' const ok = true;',
      "+const token = 'sk-proj-example';",
      '-const old = false;',
      '+const next = true;'
    ].join('\n');

    const result = parseUnifiedDiff(diff);

    expect(result.files).toEqual(['src/app.ts']);
    expect(result.lines.filter((line) => line.kind === 'added')).toEqual([
      {
        filePath: 'src/app.ts',
        oldLine: null,
        newLine: 2,
        content: "const token = 'sk-proj-example';",
        kind: 'added'
      },
      {
        filePath: 'src/app.ts',
        oldLine: null,
        newLine: 3,
        content: 'const next = true;',
        kind: 'added'
      }
    ]);
  });
});
