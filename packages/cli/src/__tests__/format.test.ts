import { describe, expect, it } from 'vitest';
import type { AuditResult } from '@patchproof/core';
import { formatResult } from '../format.js';

const result: AuditResult = {
  summary: {
    total: 1,
    critical: 1,
    high: 0,
    medium: 0,
    low: 0,
    filesScanned: 1
  },
  findings: [
    {
      id: 'abc123',
      ruleId: 'PP001',
      severity: 'critical',
      confidence: 'high',
      title: 'OpenAI API key committed in code',
      description: 'Secret in diff.',
      file: 'src/app.ts',
      line: 2,
      evidence: 'const key = "sk-proj-abc"',
      recommendation: 'Use an environment variable.',
      tags: ['security']
    }
  ]
};

const emptyResult: AuditResult = {
  summary: {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    filesScanned: 9
  },
  findings: []
};

describe('formatResult', () => {
  it('formats markdown reports', () => {
    expect(formatResult(result, 'markdown')).toContain('| critical | PP001 | src/app.ts:2 |');
  });

  it('formats SARIF reports', () => {
    const sarif = JSON.parse(formatResult(result, 'sarif')) as { runs: Array<{ results: unknown[] }> };

    expect(sarif.runs[0].results).toHaveLength(1);
  });

  it('formats Spanish markdown reports', () => {
    const formatted = formatResult(result, 'markdown', 'es');

    expect(formatted).toContain('# Informe PatchProof');
    expect(formatted).toContain('Clave API de OpenAI comprometida en código');
  });

  it('shows an explicit no-findings message', () => {
    const markdown = formatResult(emptyResult, 'markdown');
    const text = formatResult(emptyResult, 'text');

    expect(markdown).toContain('No findings found.');
    expect(markdown).not.toContain('| Severity | Rule | Location | Finding | Recommendation |');
    expect(text).toContain('No findings found.');
  });
});
