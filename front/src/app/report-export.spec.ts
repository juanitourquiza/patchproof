import { describe, expect, it } from 'vitest';

import { defaultReportFileName, formatScanReport } from './report-export';

describe('report-export', () => {
  const scan = {
    id: 5,
    project: {
      id: 1,
      name: 'greenway-api-c',
      slug: 'greenway-api-c',
      description: 'Greenway API C repo',
    },
    source: 'ppscan',
    language: 'en',
    fail_on: 'high',
    format: 'json',
    status: 'completed',
    summary: {
      total: 0,
      high: 0,
      medium: 0,
      low: 0,
      filesScanned: 37,
    },
    findings: [],
    metadata: {},
    report_url: null,
    created_at: '2026-05-30T00:29:52.000Z',
    updated_at: '2026-05-30T00:29:52.000Z',
  };

  it('builds a stable report filename', () => {
    expect(defaultReportFileName(scan, 'markdown')).toBe('patchproof-greenway-api-c-report.md');
    expect(defaultReportFileName(scan, 'json')).toBe('patchproof-greenway-api-c-report.json');
  });

  it('formats a markdown report', () => {
    const report = formatScanReport(
      scan,
      'markdown',
      'en',
      {
        scan_id: 5,
        source: 'ai',
        provider: 'openai',
        model: 'gpt-4.1-mini',
        summary: 'AI review complete.',
        confidence_average: '0.82',
        suggestions: [
          {
            title: 'Possible auth bypass',
            severity: 'high',
            confidence: '0.86',
            rationale: 'The login flow returns a generic response for unknown users.',
            recommendation: 'Keep the generic response and verify timing consistency.',
            category: 'authentication',
            needs_human_review: true,
          },
        ],
      }
    );

    expect(report).toContain('# PatchProof Report');
    expect(report).toContain('## Executive summary');
    expect(report).toContain('## Index');
    expect(report).toContain('## Cover');
    expect(report).toContain('- Project: greenway-api-c (greenway-api-c)');
    expect(report).toContain('- Files reviewed: 37');
    expect(report).toContain('- Security score: 100/100');
    expect(report).toContain('- Result: Clean result');
    expect(report).toContain('- Result summary: No findings were recorded. Keep the clean baseline for future comparisons.');
    expect(report).toContain('- AI suggestions: 1');
    expect(report).toContain('- Recommendation: Review AI suggestions and validate the highlighted code paths manually.');
    expect(report).toContain('Found **0** finding(s) across **37** file(s).');
    expect(report).toContain('No findings found.');
    expect(report).toContain('## AI review');
    expect(report).toContain('Possible auth bypass');
    expect(report).toContain('AI review complete.');
  });

  it('formats a json report', () => {
    const report = formatScanReport(
      {
        ...scan,
        findings: [
          {
            ruleId: 'PP002',
            severity: 'high',
            file: 'src/controllers/auth.controller.ts',
            line: 49,
            title: 'Potential SQL injection',
            description: 'The added line builds a SQL statement with string concatenation.',
            recommendation: 'Use bound parameters.',
          },
        ],
      },
      'json'
    );

    const parsed = JSON.parse(report) as {
      summary: { total: number; files: number };
      findings: Array<{ ruleId: string; file: string }>;
      result: { score: number; label: string; finding_total: number };
      ai_review: null;
    };

    expect(parsed.summary.total).toBe(0);
    expect(parsed.summary.files).toBe(37);
    expect(parsed.result.score).toBe(80);
    expect(parsed.result.label).toBe('Low-risk result');
    expect(parsed.result.finding_total).toBe(1);
    expect(parsed.ai_review).toBeNull();
    expect(parsed.findings[0]?.ruleId).toBe('PP002');
    expect(parsed.findings[0]?.file).toBe('src/controllers/auth.controller.ts');
  });
});
